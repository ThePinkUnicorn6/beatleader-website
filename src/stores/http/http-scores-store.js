import createHttpStore from './http-store';
import beatMapsEnhancer from './enhancers/common/beatmaps'
import accEnhancer from './enhancers/scores/acc'
import beatSaviorEnhancer from './enhancers/scores/beatsavior'
import rankedsEnhancer from './enhancers/leaderboard/rankeds'
import compareEnhancer from './enhancers/scores/compare'
import diffEnhancer from './enhancers/scores/diff'
import twitchEnhancer from './enhancers/scores/twitch'
import ppAttributionEnhancer from './enhancers/scores/pp-attribution'
import hasReplayEnhancer from './enhancers/scores/replay'
import {debounce} from '../../utils/debounce'
import createApiScoresProvider from './providers/api-scores'
import produce, {applyPatches} from 'immer'
import stringify from 'json-stable-stringify'

export default (playerId = null, service = 'scoresaber', serviceParams = {type: 'recent', page: 1}, initialState = null, initialStateType = 'initial') => {
  let currentPlayerId = playerId;
  let currentService = service;
  let currentServiceParams = serviceParams;

  let totalScores = null;

  const getCurrentEnhanceTaskId = () => `${currentPlayerId}/${currentService}/${stringify(currentServiceParams)}`;
  const getPatchId = (playerId, scoreRow) => `${playerId}/${scoreRow?.leaderboard?.leaderboardId}`

  let enhancePatches = {};
  let currentEnhanceTaskId = null;

  const onBeforeStateChange = (state) => {
    if (state?.scores) {
      totalScores = state?.total ?? null;
      return state.scores;
    }

    totalScores = state !== null ? null : 0;

    return state;
  }

  const onNewData = ({fetchParams, state, stateType, set}) => {
    currentPlayerId = fetchParams?.playerId ?? null;
    currentService = fetchParams?.service ?? null;
    currentServiceParams = fetchParams?.serviceParams ?? null;

    if (state && state.scores) {
      state = onBeforeStateChange(state);
      set(state);
    }

    if (!state || !Array.isArray(state)) return;

    const enhanceTaskId = getCurrentEnhanceTaskId();
    if (currentEnhanceTaskId !== enhanceTaskId) {
      enhancePatches = {}
      currentEnhanceTaskId = enhanceTaskId;
    }

    const stateProduce = (state, patchId, producer) => produce(state, producer, patches => {
      if (!enhancePatches[patchId]) enhancePatches[patchId] = [];

      enhancePatches[patchId].push(...patches)
    })

    const debouncedSetState = debounce((enhanceTaskId, state) => {
      if (currentEnhanceTaskId !== enhanceTaskId) return;

      set(state);
    }, 200);

    const newState = [...state];

    const setStateRow = (enhanceTaskId, scoreRow) => {
      if (currentEnhanceTaskId !== enhanceTaskId) return null;

      const patchId = getPatchId(currentPlayerId, scoreRow)
      const stateRowIdx = newState.findIndex(s => getPatchId(currentPlayerId, s) === patchId)
      if (stateRowIdx < 0) return;

      newState[stateRowIdx] = applyPatches(newState[stateRowIdx], enhancePatches[patchId]);

      debouncedSetState(enhanceTaskId, newState);

      return newState[stateRowIdx];
    }

    for (const scoreRow of newState) {
      if (currentService !== 'accsaber') {
        stateProduce(scoreRow, getPatchId(currentPlayerId, scoreRow), draft => beatMapsEnhancer(draft))
          .then(scoreRow => stateProduce(scoreRow, getPatchId(currentPlayerId, scoreRow), draft => accEnhancer(draft)))
          .then(scoreRow => setStateRow(enhanceTaskId, scoreRow))
          .then(scoreRow => stateProduce(scoreRow, getPatchId(currentPlayerId, scoreRow), draft => diffEnhancer(draft, currentPlayerId)))
          .then(scoreRow => setStateRow(enhanceTaskId, scoreRow))
          .then(scoreRow => stateProduce(scoreRow, getPatchId(currentPlayerId, scoreRow), draft => compareEnhancer(draft, currentPlayerId)))
          .then(scoreRow => setStateRow(enhanceTaskId, scoreRow))
          .then(scoreRow => stateProduce(scoreRow, getPatchId(currentPlayerId, scoreRow), draft => twitchEnhancer(draft, currentPlayerId)))
          .then(scoreRow => setStateRow(enhanceTaskId, scoreRow))

        stateProduce(scoreRow, getPatchId(currentPlayerId, scoreRow), draft => rankedsEnhancer(draft))
          .then(scoreRow => setStateRow(enhanceTaskId, scoreRow))

        stateProduce(scoreRow, getPatchId(currentPlayerId, scoreRow), draft => ppAttributionEnhancer(draft, currentPlayerId))
          .then(scoreRow => setStateRow(enhanceTaskId, scoreRow))
        
        stateProduce(scoreRow, getPatchId(currentPlayerId, scoreRow), draft => hasReplayEnhancer(draft, currentPlayerId))
          .then(scoreRow => setStateRow(enhanceTaskId, scoreRow))

        if (stateType && stateType === 'live')
          stateProduce(scoreRow, getPatchId(currentPlayerId, scoreRow), draft => beatSaviorEnhancer(draft, currentPlayerId))
            .then(scoreRow => setStateRow(enhanceTaskId, scoreRow))
      } else {
        stateProduce(scoreRow, getPatchId(currentPlayerId, scoreRow), draft => beatMapsEnhancer(draft))
          .then(scoreRow => setStateRow(enhanceTaskId, scoreRow))
          .then(scoreRow => stateProduce(scoreRow, getPatchId(currentPlayerId, scoreRow), draft => twitchEnhancer(draft, currentPlayerId)))
          .then(scoreRow => setStateRow(enhanceTaskId, scoreRow))
          .then(scoreRow => stateProduce(scoreRow, getPatchId(currentPlayerId, scoreRow), draft => beatSaviorEnhancer(draft, currentPlayerId)))
          .then(scoreRow => setStateRow(enhanceTaskId, scoreRow))
      }
    }
  }

  const provider = createApiScoresProvider();

  const httpStore = createHttpStore(
    provider,
    playerId ? {playerId, service, serviceParams} : null,
    initialState,
    {
      onInitialized: onNewData,
      onBeforeStateChange,
      onAfterStateChange: onNewData,
      onSetPending: ({fetchParams}) => ({...fetchParams}),
    },
    initialStateType
  );

  const fetch = async (serviceParams = currentServiceParams, service = currentService, playerId = currentPlayerId, force = false) => {
    if (
      (!playerId || playerId === currentPlayerId) &&
      (!service || stringify(service) === stringify(currentService)) &&
      (!serviceParams || stringify(serviceParams) === stringify(currentServiceParams)) &&
      !force
    )
      return false;

    return httpStore.fetch({playerId, service, serviceParams}, force, provider, !playerId || playerId !== currentPlayerId || force);
  }

  const refresh = async () => fetch(currentServiceParams, currentService, currentPlayerId, true);

  return {
    ...httpStore,
    fetch,
    refresh,
    getPlayerId: () => currentPlayerId,
    getService: () => currentService,
    getServiceParams: () => currentServiceParams,
    getTotalScores: () => totalScores,
  }
}

