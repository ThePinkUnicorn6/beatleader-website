import {PRIORITY} from '../network/queues/http-queue';
import createPlayerService from './scoresaber/player'
import createScoresService from './scoresaber/scores'
import beatSaviorApiClient from '../network/clients/beatsavior/api';
import beatSaviorRepository from '../db/repository/beat-savior'
import beatSaviorPlayersRepository from '../db/repository/beat-savior-players'
import {addToDate, DAY, formatDate, HOUR, MINUTE, SECOND} from '../utils/date'
import log from '../utils/logger'
import {opt} from '../utils/js'
import makePendingPromisePool from '../utils/pending-promises'

const MAIN_PLAYER_REFRESH_INTERVAL = MINUTE * 15;
const CACHED_PLAYER_REFRESH_INTERVAL = HOUR * 3;
const OTHER_PLAYER_REFRESH_INTERVAL = DAY;

let service = null;
let serviceCreationCount = 0;
export default () => {
  serviceCreationCount++;
  if (service) return service;

  const resolvePromiseOrWaitForPending = makePendingPromisePool();

  const playerService = createPlayerService();
  const scoresService = createScoresService();

  const getPlayerBeatSaviorData = async playerId => resolvePromiseOrWaitForPending(`getPlayerBeatSaviorData/${playerId}`, () => beatSaviorRepository().getAllFromIndex('beat-savior-playerId', playerId));

  const getPlayerScores = async playerId => resolvePromiseOrWaitForPending(`getPlayerScores/${playerId}`, () => scoresService.getPlayerScoresAsObject(
    playerId,
    score => {
      const key = opt(score, 'leaderboard.song.hash');
      return key ? key.toLowerCase() : null;
    },
    true,
  ))

  const isScoreMatchingBsData = (score, bsData, exact = true) => {
    if (!bsData.hash || !bsData.score || !bsData.timeSet || !opt(bsData, 'stats.won')) return false;

    const diff = opt(score, 'leaderboard.diffInfo.diff');
    const scoreValue = opt(score, 'score.score');
    const timeSet = opt(score, 'score.timeSet')
    let hash = opt(score, 'leaderboard.song.hash');

    if (!diff || !score || !timeSet || !hash) return false;

    hash = hash.toLowerCase();

    if (bsData.hash === hash && bsData.diff === diff) {
      return !exact || (bsData.score === scoreValue && Math.abs(timeSet.getTime() - bsData.timeSet.getTime()) < MINUTE);
    }

    return false;
  }

  const updateData = async (playerId, data) => {
    log.debug(`Updating Beat Savior data for player "${playerId}"...`, 'BeatSaviorService')

    await Promise.all(data.map(async d => beatSaviorRepository().set(d)));

    log.debug(`Update player "${playerId}" Beat Savior last refresh date...`, 'BeatSaviorService')

    await beatSaviorPlayersRepository().set({playerId, lastRefresh: new Date()})

    log.debug(`Beat Savior data for player "${playerId}" updated.`, 'BeatSaviorService')

    return data;
  }

  const fetchPlayer = async (playerId, priority = PRIORITY.BG_NORMAL) => {
    try {
      log.debug(`Fetching Beat Savior data for player "${playerId}"...`, 'BeatSaviorService');

      const data = await beatSaviorApiClient.getProcessed({playerId, priority});
      if (!data) {
        log.debug(`No Beat Savior data for player "${playerId}"`, 'BeatSaviorService')

        return null;
      }

      // TODO: check if data already exists in DB

      log.trace(`Beat Savior data for player "${playerId}" fetched`, 'BeatSaviorService', data);

      return updateData(playerId, data);
    } catch (err) {
      log.warn(`Error fetching Beat Savior data for player "${playerId}"`);

      return null;
    }
  }

  const refresh = async (playerId, force = false, priority = PRIORITY.BG_NORMAL, throwErrors = false) => {
    log.trace(`Starting refreshing BeatSavior for player "${playerId}" ${force ? ' (forced)' : ''}...`, 'BeatSaviorService')

    try {
      const player = await playerService.get(playerId);

      const REFRESH_INTERVAL = playerService.isMainPlayer(playerId) ? MAIN_PLAYER_REFRESH_INTERVAL : (player ? CACHED_PLAYER_REFRESH_INTERVAL : OTHER_PLAYER_REFRESH_INTERVAL);

      const bsPlayerInfo = await beatSaviorPlayersRepository().get(playerId);
      const nextUpdate = bsPlayerInfo && bsPlayerInfo.lastRefresh ? addToDate(REFRESH_INTERVAL, bsPlayerInfo.lastRefresh) : addToDate(-SECOND);
      if (!force && bsPlayerInfo && nextUpdate > new Date()) {
        log.debug(`Beat Savior data is still fresh, skipping. Next refresh on ${formatDate(nextUpdate)}`, 'BeatSaviorService')

        return null;

        if (player) {
          log.trace(`Player "${playerId}" is a cached one, checking recent play date`, 'BeatSaviorService')

          if (player.recentPlay && player.recentPlay < bsPlayerInfo.lastRefresh) {
            log.debug(`Beat Savior data for player "${playerId}" was refreshed after recent play, skipping`, 'BeatSaviorService')

            return null;
          }
        }
      }

      return resolvePromiseOrWaitForPending(`refresh/${playerId}`, () => fetchPlayer(playerId, priority));
    } catch (e) {
      if (throwErrors) throw e;

      log.debug(`Beat Savior data refreshing error${e.toString ? `: ${e.toString()}` : ''}`, 'BeatSaviorService', e)

      return null;
    }
  }

  const refreshAll = async (force = false, priority = PRIORITY.BG_NORMAL, throwErrors = false) => {
    log.trace(`Starting refreshing Beat Savior data for all players${force ? ' (forced)' : ''}...`, 'BeatSaviorService');

    const allPlayers = await playerService.getAll();
    if (!allPlayers || !allPlayers.length) {
      log.trace(`No players in DB, skipping.`, 'BeatSaviorService');
      return null;
    }

    const allRefreshed = await Promise.all(allPlayers.map(async player => ({
      playerId: player.playerId,
      beatSavior: await refresh(player.playerId, force, priority, throwErrors),
    })));

    log.trace(`Beat Savior data for all players refreshed.`, 'BeatSaviorService', allRefreshed);

    return allRefreshed;
  }

  const get = async (playerId, score) => {
    if (score && score.beatSavior) return score.beatSavior;

    const playerBsData = await getPlayerBeatSaviorData(playerId);
    if (!playerBsData || !playerBsData.length) return null;

    const bsData = playerBsData.find(bsData => isScoreMatchingBsData(score, bsData, true));

    return bsData ? bsData : null;
  }

  const getAllPlayerScores = async playerId => beatSaviorRepository().getAllFromIndex('beat-savior-playerId', playerId);

  const isDataForPlayerAvailable = async playerId => await beatSaviorRepository().getFromIndex('beat-savior-playerId', playerId) !== undefined;

  const destroyService = () => {
    serviceCreationCount--;

    if (serviceCreationCount === 0) {
      scoresService.destroyService();
      playerService.destroyService();

      service = null;
    }
  }

  service = {
    fetchPlayer,
    refresh,
    refreshAll,
    get,
    getAllPlayerScores,
    isDataForPlayerAvailable,
    destroyService,
  }

  return service;
}