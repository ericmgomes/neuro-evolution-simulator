const PANEL_DEFINITIONS = [
  {
    id: 'simulation',
    title: 'Simulação',
    position: 'top-left',
    metrics: [
      ['generation', 'Geração'],
      ['time', 'Tempo'],
      ['networkDetail', 'Rede'],
    ],
  },
  {
    id: 'population',
    title: 'População',
    position: 'top-left second',
    metrics: [
      ['alive', 'Vivos'],
      ['dead', 'Mortos'],
      ['alivePercent', '% vivos'],
      ['deadPercent', '% mortos'],
    ],
  },
  {
    id: 'evolution',
    title: 'Evolução',
    position: 'top-right',
    metrics: [
      ['heirs', 'Herdeiros'],
      ['elite', 'Elite'],
      ['newcomers', 'Novos'],
      ['childrenFromTop1', 'Top 1'],
      ['childrenFromTop5', 'Top 5'],
      ['dominantLineage', 'Dominante'],
    ],
  },
  {
    id: 'world',
    title: 'Ambiente',
    position: 'right-center',
    metrics: [
      ['foodAvailable', 'Comida'],
      ['foodCollected', 'Coletada'],
      ['averageEnergy', 'Energia média'],
      ['predatorKills', 'Abates'],
      ['predatorReward', 'Recompensa'],
    ],
  },
  {
    id: 'last',
    title: 'Última Geração',
    position: 'bottom-left',
    metrics: [
      ['lastSurvivors', 'Sobrev.'],
      ['lastPredatorDeaths', 'Comidos'],
      ['lastMapDeaths', 'Mapa'],
      ['lastObstacleDeaths', 'Obst.'],
    ],
  },
  {
    id: 'fitness',
    title: 'Fitness',
    position: 'bottom-left second',
    metrics: [
      ['bestFitness', 'Melhor'],
      ['averageFitness', 'Médio'],
    ],
  },
  {
    id: 'compare',
    title: 'Comparar',
    position: 'bottom-center',
    metrics: [
      ['compareFitness', 'Fitness'],
      ['compareFood', 'Comida'],
      ['compareSurvivors', 'Sobrev.'],
      ['comparePredatorDeaths', 'Comidos'],
      ['compareObstacleDeaths', 'Obst.'],
      ['compareLifetime', 'Tempo vivo'],
    ],
  },
  {
    id: 'inspection',
    title: 'Inspeção',
    position: 'left-center',
    metrics: [
      ['selectedType', 'Tipo'],
      ['selectedId', 'ID'],
      ['selectedEnergy', 'Energia'],
      ['selectedFitness', 'Fitness'],
      ['selectedPredatorDistance', 'Alvo'],
      ['selectedObstacleDistance', 'Obst.'],
    ],
  },
];

export class HUD {
  constructor({
    root,
    config,
    onTogglePause,
    onReset,
    onSpeedChange,
    onArenaSizeChange,
    onFoodCountChange,
    onPlacementModeChange,
    onTopologyChange,
    onTrailsVisibleChange,
    onTrailHistoryChange,
  }) {
    this.root = root;
    this.config = config;
    this.onTogglePause = onTogglePause;
    this.onReset = onReset;
    this.onSpeedChange = onSpeedChange;
    this.onArenaSizeChange = onArenaSizeChange;
    this.onFoodCountChange = onFoodCountChange;
    this.onPlacementModeChange = onPlacementModeChange;
    this.onTopologyChange = onTopologyChange;
    this.onTrailsVisibleChange = onTrailsVisibleChange;
    this.onTrailHistoryChange = onTrailHistoryChange;
    this.elements = new Map();
    this.panelButtons = new Map();
    this.panels = new Map();
    this.container = null;
    this.hidden = false;
    this.visiblePanels = new Set(['simulation', 'population', 'compare', 'controls']);
  }

  setup() {
    this.container = document.createElement('div');
    this.container.className = 'hud';
    this.container.innerHTML = this.getTemplate();
    this.root.appendChild(this.container);
    this.cacheElements();
    this.bindControls();
    this.syncPanelVisibility();
  }

  getTemplate() {
    return `
      <nav class="hud-context-bar" aria-label="Painéis do HUD">
        <button class="hud-toggle" type="button" data-action="toggle-hud">HUD</button>
        ${PANEL_DEFINITIONS.map((panel) => this.panelToggle(panel)).join('')}
        <button class="hud-chip is-active" type="button" data-panel-toggle="controls">Editor</button>
      </nav>
      <div class="hud-panels">
        ${PANEL_DEFINITIONS.map((panel) => this.panel(panel)).join('')}
        ${this.controlsPanel()}
      </div>
    `;
  }

  panelToggle(panel) {
    return `
      <button class="hud-chip is-active" type="button" data-panel-toggle="${panel.id}">
        ${panel.title}
      </button>
    `;
  }

  panel(panel) {
    return `
      <section class="hud-panel hud-panel-${panel.position}" data-panel="${panel.id}">
        <header class="hud-panel-header">
          <span>${panel.title}</span>
          <button class="hud-panel-close" type="button" data-panel-close="${panel.id}">x</button>
        </header>
        <div class="metric-grid">${panel.metrics.map(([key, label]) => this.metric(key, label)).join('')}</div>
      </section>
    `;
  }

  controlsPanel() {
    return `
      <section class="hud-panel hud-panel-controls" data-panel="controls">
        <header class="hud-panel-header">
          <span>Editor</span>
          <button class="hud-panel-close" type="button" data-panel-close="controls">x</button>
        </header>
        <div class="button-row">
          <button class="hud-button" type="button" data-action="pause">Pause</button>
          <button class="hud-button" type="button" data-action="reset">Reset</button>
        </div>
        <div class="placement-row">
          <button class="hud-button" type="button" data-place="food">Comida</button>
          <button class="hud-button" type="button" data-place="mountain">Montanha</button>
          <button class="hud-button" type="button" data-place="lake">Lago</button>
        </div>
        <div class="control-row">
          <label for="sim-speed">Velocidade</label>
          <input id="sim-speed" type="range" min="0.25" max="80" step="0.25" value="${this.config.speed.defaultMultiplier}" />
          <span class="control-value" data-speed-value>${this.config.speed.defaultMultiplier}x</span>
        </div>
        <div class="control-row">
          <label for="arena-size">Mapa</label>
          <input id="arena-size" type="range" min="24" max="120" step="4" value="${this.config.arenaSize}" />
          <span class="control-value" data-arena-value>${this.config.arenaSize}u</span>
        </div>
        <div class="control-row">
          <label for="food-count">Comida</label>
          <input id="food-count" type="range" min="0" max="240" step="5" value="${this.config.food.count}" />
          <span class="control-value" data-food-value>${this.config.food.count}</span>
        </div>
        <div class="control-row">
          <label for="neural-preset">Neural</label>
          <select id="neural-preset" class="hud-select">
            ${this.neuralOptions()}
          </select>
        </div>
        <label class="check-row" for="trail-visible">
          <span>Mostrar rastros</span>
          <input id="trail-visible" type="checkbox" ${this.config.trails.visible ? 'checked' : ''} />
        </label>
        <label class="check-row" for="trail-history">
          <span>Manter rastros</span>
          <input id="trail-history" type="checkbox" ${this.config.trails.preserveHistory ? 'checked' : ''} />
        </label>
      </section>
    `;
  }

  neuralOptions() {
    return this.config.neuralPresets
      .map((preset) => {
        const topology = preset.topology.join('-');
        const selected = topology === this.config.topology.join('-') ? ' selected' : '';
        return `<option value="${preset.id}"${selected}>${preset.label} ${topology}</option>`;
      })
      .join('');
  }

  metric(key, label) {
    return `
      <div class="metric">
        <span class="metric-label">${label}</span>
        <span class="metric-value" data-metric="${key}">0</span>
      </div>
    `;
  }

  cacheElements() {
    for (const element of this.container.querySelectorAll('[data-metric]')) {
      this.elements.set(element.dataset.metric, element);
    }

    for (const panel of this.container.querySelectorAll('[data-panel]')) {
      this.panels.set(panel.dataset.panel, panel);
    }

    for (const button of this.container.querySelectorAll('[data-panel-toggle]')) {
      this.panelButtons.set(button.dataset.panelToggle, button);
    }

    this.speedValue = this.container.querySelector('[data-speed-value]');
    this.arenaValue = this.container.querySelector('[data-arena-value]');
    this.foodValue = this.container.querySelector('[data-food-value]');
    this.pauseButton = this.container.querySelector('[data-action="pause"]');
    this.hudToggleButton = this.container.querySelector('[data-action="toggle-hud"]');
    this.neuralSelect = this.container.querySelector('#neural-preset');
    this.trailVisibleInput = this.container.querySelector('#trail-visible');
    this.trailHistoryInput = this.container.querySelector('#trail-history');
    this.placementButtons = [...this.container.querySelectorAll('[data-place]')];
  }

  bindControls() {
    this.hudToggleButton.addEventListener('click', () => this.toggleHud());
    this.pauseButton.addEventListener('click', () => this.onTogglePause());
    this.container
      .querySelector('[data-action="reset"]')
      .addEventListener('click', () => this.onReset());
    this.container.querySelector('#sim-speed').addEventListener('input', (event) => {
      const value = Number(event.target.value);
      this.speedValue.textContent = `${value.toFixed(2).replace(/\.00$/, '')}x`;
      this.onSpeedChange(value);
    });
    this.container.querySelector('#arena-size').addEventListener('input', (event) => {
      const value = Number(event.target.value);
      this.arenaValue.textContent = `${value}u`;
      this.onArenaSizeChange(value);
    });
    this.container.querySelector('#food-count').addEventListener('input', (event) => {
      const value = Number(event.target.value);
      this.foodValue.textContent = value;
      this.onFoodCountChange(value);
    });
    this.neuralSelect.addEventListener('change', (event) => {
      this.requestTopologyChange(event.target.value);
    });
    this.trailVisibleInput.addEventListener('change', (event) => {
      this.onTrailsVisibleChange(event.target.checked);
    });
    this.trailHistoryInput.addEventListener('change', (event) => {
      this.onTrailHistoryChange(event.target.checked);
    });

    for (const button of this.placementButtons) {
      button.addEventListener('click', () => this.onPlacementModeChange(button.dataset.place));
    }

    for (const button of this.panelButtons.values()) {
      button.addEventListener('click', () => this.togglePanel(button.dataset.panelToggle));
    }

    for (const button of this.container.querySelectorAll('[data-panel-close]')) {
      button.addEventListener('click', () => this.togglePanel(button.dataset.panelClose, false));
    }
  }

  update(stats) {
    this.set('generation', stats.generation);
    this.set('alive', stats.alive);
    this.set('dead', stats.dead);
    this.set('alivePercent', `${stats.alivePercent.toFixed(0)}%`);
    this.set('deadPercent', `${stats.deadPercent.toFixed(0)}%`);
    this.set('heirs', stats.generationComposition.inherited);
    this.set('elite', stats.generationComposition.elite);
    this.set('newcomers', stats.generationComposition.newcomers);
    this.set('lastSurvivors', stats.lastGenerationResult.survivors);
    this.set('lastPredatorDeaths', stats.lastGenerationResult.predatorDeaths);
    this.set('lastMapDeaths', stats.lastGenerationResult.mapDeaths);
    this.set('lastObstacleDeaths', stats.lastGenerationResult.obstacleDeaths);
    this.set('childrenFromTop1', stats.generationComposition.childrenFromTop1);
    this.set('childrenFromTop5', stats.generationComposition.childrenFromTop5);
    this.set('dominantLineage', `${stats.lastGenerationResult.dominantLineagePercent.toFixed(0)}%`);
    this.set('foodAvailable', stats.foodAvailable);
    this.set('foodCollected', stats.foodCollected);
    this.set('averageEnergy', stats.averageEnergy.toFixed(2));
    this.set('predatorKills', stats.predatorKills);
    this.set('predatorReward', stats.predatorReward.toFixed(0));
    this.set('bestFitness', stats.bestFitness.toFixed(2));
    this.set('averageFitness', stats.averageFitness.toFixed(2));
    this.updateComparison(stats.comparison);
    this.set('time', `${stats.generationTime.toFixed(1)}s`);
    this.set('networkDetail', stats.network);
    this.updateSelected(stats.selectedOrganism);
    this.arenaValue.textContent = `${stats.arenaSize}u`;
    this.foodValue.textContent = stats.foodAvailable;
    this.pauseButton.textContent = stats.paused ? 'Play' : 'Pause';
    this.syncNeuralSelect(stats.network);
  }

  updateSelected(selected) {
    if (!selected) {
      this.set('selectedType', '-');
      this.set('selectedId', '-');
      this.set('selectedEnergy', '-');
      this.set('selectedFitness', '-');
      this.set('selectedPredatorDistance', '-');
      this.set('selectedObstacleDistance', '-');
      return;
    }

    this.set('selectedType', selected.type);
    this.set('selectedId', selected.id);
    this.set('selectedEnergy', selected.energy === null ? '-' : selected.energy.toFixed(2));
    this.set('selectedFitness', selected.fitness.toFixed(1));
    this.set('selectedPredatorDistance', selected.predatorDistance.toFixed(1));
    this.set('selectedObstacleDistance', selected.obstacleDistance.toFixed(1));
  }

  updateComparison(comparison) {
    if (!comparison.ready) {
      this.set('compareFitness', '-');
      this.set('compareFood', '-');
      this.set('compareSurvivors', '-');
      this.set('comparePredatorDeaths', '-');
      this.set('compareObstacleDeaths', '-');
      this.set('compareLifetime', '-');
      return;
    }

    this.set('compareFitness', this.formatDelta(comparison.fitnessDelta, 2));
    this.set('compareFood', this.formatDelta(comparison.foodDelta, 0));
    this.set('compareSurvivors', this.formatDelta(comparison.survivorDelta, 0));
    this.set('comparePredatorDeaths', this.formatDelta(comparison.predatorDeathDelta, 0));
    this.set('compareObstacleDeaths', this.formatDelta(comparison.obstacleDeathDelta, 0));
    this.set('compareLifetime', `${this.formatDelta(comparison.lifetimeDelta, 1)}s`);
  }

  formatDelta(value, decimals) {
    const fixed = value.toFixed(decimals);

    if (value > 0) {
      return `+${fixed}`;
    }

    return fixed;
  }

  toggleHud() {
    this.hidden = !this.hidden;
    this.container.classList.toggle('is-hidden', this.hidden);
    this.hudToggleButton.textContent = this.hidden ? 'Mostrar HUD' : 'HUD';
  }

  requestTopologyChange(presetId) {
    const preset = this.config.neuralPresets.find((item) => item.id === presetId);

    if (!preset) {
      this.syncNeuralSelect(this.config.topology.join('-'));
      return;
    }

    const changed = this.onTopologyChange(preset.topology);

    if (changed) {
      return;
    }

    this.syncNeuralSelect(this.config.topology.join('-'));
  }

  syncNeuralSelect(network) {
    const preset = this.config.neuralPresets.find((item) => item.topology.join('-') === network);

    if (!preset || this.neuralSelect.value === preset.id) {
      return;
    }

    this.neuralSelect.value = preset.id;
  }

  togglePanel(panelId, forceVisible = null) {
    if (forceVisible ?? !this.visiblePanels.has(panelId)) {
      this.visiblePanels.add(panelId);
      this.syncPanelVisibility();
      return;
    }

    this.visiblePanels.delete(panelId);
    this.syncPanelVisibility();
  }

  syncPanelVisibility() {
    for (const [panelId, panel] of this.panels) {
      const visible = this.visiblePanels.has(panelId);
      panel.classList.toggle('is-panel-hidden', !visible);
      this.panelButtons.get(panelId)?.classList.toggle('is-active', visible);
    }
  }

  set(key, value) {
    const element = this.elements.get(key);

    if (!element) {
      return;
    }

    element.textContent = value;
  }

  setPlacementMode(mode) {
    for (const button of this.placementButtons) {
      button.classList.toggle('is-active', button.dataset.place === mode);
    }
  }

  dispose() {
    this.container.remove();
  }
}
