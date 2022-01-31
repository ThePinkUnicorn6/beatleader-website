<script>
  import {setContext} from 'svelte'
  import {exportJsonData} from './utils/export-import'
  import {Router, Route, navigate} from "svelte-routing";
  import buildInfo from '../build-info';
  import createContainerStore from './stores/container';
  import HomePage from './pages/Home.svelte';
  import SearchPage from './pages/Search.svelte';
  import RankingPage from './pages/Ranking.svelte';
  import LeaderboardPage from './pages/Leaderboard.svelte';
  import FriendsPage from './pages/Friends.svelte';
  import PlayerPage from './pages/Player.svelte';
  import TwitchPage from './pages/Twitch.svelte';
  import NotFoundPage from './pages/NotFound.svelte';
  import PrivacyPage from './pages/Privacy.svelte';
  import AboutPage from './pages/About.svelte';
  import DashboardPage from './pages/Dashboard.svelte';
  import PlaylistsPage from './pages/Playlists.svelte';
  import Nav from './components/Nav.svelte';
  import Modal from 'svelte-simple-modal';

  export let url = "";

  let mainEl = null;

  const containerStore = createContainerStore();

  setContext('pageContainer', containerStore);

  $: if (mainEl) containerStore.observe(mainEl)
</script>

<main>
  <article>
    <header>
      <h1 class="title is-5">Project paused </h1>
      <div class="container">
        <div class="panda-icon"></div>
      </div>
      
      <p><a href="https://scoresaber.com" rel="noreferrer">Go to scoresaber.com</a></p>
    </header>

    <p>Install the <a href="https://github.com/motzel/scoresaber-unranked-acc/raw/master/scoresaber-unranked-acc.user.js">plugin</a> to add replay button to ScoreSaber.</p>
    <p>Check out <a href="https://discord.gg/2RG5YVqtG6">Discord</a> if you interested in future of this project.</p>
    <p>Download your stored data <a href="/" on:click|preventDefault={() => exportJsonData()}>here</a> (wait a few seconds) </p>

    <p>...and don't forget about the other great sites that will supplement your new data.</p>

    <p>
      <a href="https://www.beatsavior.io/" rel="noreferrer">Beat Savior</a>
      <small>detailed data on your swings, install <a href="https://github.com/Mystogan98/BeatSaviorData" rel="noreferrer">BS mod</a> first</small>
    </p>

    <p>
      <a href="https://www.accsaber.com/" rel="noreferrer">AccSaber</a>
      <small>if you want to become an acc champ</small>
    </p>
  

<!-- <Router {url}>
  <Nav />
  <Modal closeButton={false} styleWindow={{width: "90vw", height: "65vh"}} styleContent={{padding: 0}}>

  <main bind:this={mainEl}>
    <div class="ssr-page-container">
      <Route path="/" component="{HomePage}" />
      <Route path="/u/:initialPlayerId/*initialParams" let:params>
        <PlayerPage initialPlayerId={params.initialPlayerId} initialParams={params.initialParams}/>
      </Route>
      <Route path="/privacy" component="{PrivacyPage}" />
      <Route path="/about" component="{AboutPage}" />
      <Route path="/friends" component="{FriendsPage}" />
      <Route path="/ranking/:type/*page" let:params>
        <RankingPage type={params.type} page={params.page} />
      </Route>
      <Route path="/leaderboard/:type/:leaderboardId/*page" let:params>
        <LeaderboardPage leaderboardId={params.leaderboardId} type={params.type} page={params.page} dontChangeType={false} />
      </Route>
      <Route path="/playlists" component="{PlaylistsPage}" />
      <Route path="/search">
        <SearchPage changeTitle={true}/>
      </Route>
      <Route path="/twitch" component="{TwitchPage}" />
      <Route path="/dashboard" component="{DashboardPage}" />
      <Route path="/*" component="{NotFoundPage}" />
    </div>
  </main>
</Modal>
</Router> -->

<footer>
  <p class="build">Build: {buildInfo.buildVersion} ({buildInfo.buildDate})</p>
  <p>
    <!-- <a href="/privacy" on:click|preventDefault={() => navigate('/privacy')}>Privacy policy</a> |
    <a href="/about" on:click|preventDefault={() => navigate('/about')}>About</a> | -->
    <a href="https://github.com/NSGolova/beatleader-website">Source</a> |
    <a href="https://discord.gg/2RG5YVqtG6">Discord</a>
  </p>
</footer>

</article>
</main>

<style>
    main {
        display: flex;
        width: 100%;
        height: 100vh;
        justify-content: center;
        align-items: center;
    }
    .container {
      display: flex;
        justify-content: center;
        align-items: center;
    }
    article > * {
        text-align: center;
    }
    header {
        margin-bottom: 4rem;
    }
    p {
        margin-bottom: .75rem;
    }
    small {
        display: block;
        font-size: .75rem;
        color: #aaa;
    }

    .ssr-page-container {
        display: grid;
        grid-template-columns: 1fr;
        grid-template-rows: 1fr;
        overflow: hidden;
        min-height: calc(100vh - 9rem);
    }

    .ssr-page-container :global(> *) {
        grid-area: 1 / 1 / 1 / 1;
    }

    .build {
        font-size: .875em;
        color: var(--faded);
    }

    footer {
        margin: 1rem 0;
        font-size: .75em;
        text-align: center;
    }
</style>