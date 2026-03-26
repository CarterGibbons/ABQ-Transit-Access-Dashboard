// =========================================================
// Transit Accessibility Web Map
// =========================================================

const CONFIG = {
  data: {
    blocksUrl: "data/blockfinal.topojson",
    isochroneFolder: "data/"
  },

  topojson: {
    blockObjectName: "layer",
    isochroneObjectName: "layer"
  },

  ids: {
    blockIdField: "GISJOIN"
  },

  map: {
    center: [35.0844, -106.6504],
    zoom: 12,
    minZoom: 12,
    maxZoom: 17,
    tileUrl: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    tileOptions: {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd"
    }
  },

  metrics: {
    svi: {
      label: "Social Vulnerability Index (SVI)",
      type: "static",
      field: "SVI",
      formatter: value => formatNumber(value, 3)
    },
    jobs: {
      label: "Jobs Access",
      type: "scenario",
      fields: {
        weekday_peak: "M8_Job_Count",
        weekday_offpeak: "M14_Job_Count",
        weekday_evening: "M20_Job_Count",
        weekend_peak: "S8_Job_Count",
        weekend_offpeak: "S14_Job_Count",
        weekend_evening: "S20_Job_Count"
      },
      formatter: value => formatNumber(value, 0)
    },
    healthcare: {
      label: "Healthcare Access",
      type: "scenario",
      fields: {
        weekday_peak: "M8_Hospital_Count",
        weekday_offpeak: "M14_Hospital_Count",
        weekday_evening: "M20_Hospital_Count",
        weekend_peak: "S8_Hospital_Count",
        weekend_offpeak: "S14_Hospital_Count",
        weekend_evening: "S20_Hospital_Count"
      },
      formatter: value => formatNumber(value, 0)
    },
    schools: {
      label: "School Access",
      type: "scenario",
      fields: {
        weekday_peak: "M8_School_Count",
        weekday_offpeak: "M14_School_Count",
        weekday_evening: "M20_School_Count",
        weekend_peak: "S8_School_Count",
        weekend_offpeak: "S14_School_Count",
        weekend_evening: "S20_School_Count"
      },
      formatter: value => formatNumber(value, 0)
    },
    food: {
      label: "Food Access",
      type: "scenario",
      fields: {
        weekday_peak: "M8_SNAP_Count",
        weekday_offpeak: "M14_SNAP_Count",
        weekday_evening: "M20_SNAP_Count",
        weekend_peak: "S8_SNAP_Count",
        weekend_offpeak: "S14_SNAP_Count",
        weekend_evening: "S20_SNAP_Count"
      },
      formatter: value => formatNumber(value, 0)
    }
  },

  timePeriods: [
    { key: "weekday_peak", label: "Weekday Peak (8 AM)" },
    { key: "weekday_offpeak", label: "Weekday Off-Peak (2 PM)" },
    { key: "weekday_evening", label: "Weekday Evening (8 PM)" },
    { key: "weekend_peak", label: "Weekend Peak (8 AM)" },
    { key: "weekend_offpeak", label: "Weekend Off-Peak (2 PM)" },
    { key: "weekend_evening", label: "Weekend Evening (8 PM)" }
  ],

  sviBreaks: [0.2, 0.4, 0.6, 0.8, 1.0],

  colors: ["#eff3ff", "#c6dbef", "#9ecae1", "#6baed6",  "#3182bd", "#08519c" ],

  styles: {
    choropleth: {
      color: "#666666",
      weight: 0.7,
      fillOpacity: 0.75
    },
    outline: {
      color: "#8a8a8a",
      weight: 0.5,
      fillColor: "#ffffff",
      fillOpacity: 0.02
    },
    selectedBlock: {
      color: "#111111",
      weight: 3,
      fillColor: "#ffffff",
      fillOpacity: 0.06
    },
    isochrone: {
      color: "#2563eb",
      weight: 2,
      fillColor: "#60a5fa",
      fillOpacity: 0.18
    }
  },

  geocoder: {
    placeholder: "Search address"
  }
};

const appState = {
  map: null,
  mode: "choropleth",
  selectedMetric: "svi",
  selectedTimePeriod: "weekday_peak",
  selectedBlockId: null,
  selectedFeature: null,
  blocksGeoJSON: null,
  blockLayer: null,
  isochroneLayer: null,
  addressMarker: null,
  geocoderControl: null,
  isochroneCache: {},
  
  classification: {
    values: [],
    breaks: []
  },

  charts: {
    metricChart: null,
    scatterChart: null
  }
};

const dom = {
  metricSelect: document.getElementById("metricSelect"),
  timeScenario: document.getElementById("timeScenario"),
  choroplethMode: document.getElementById("choroplethMode"),
  isochroneMode: document.getElementById("isochroneMode"),
  geocoderContainer: document.getElementById("geocoder-container"),
  clearSelectionBtn: document.getElementById("clearSelectionBtn"),
  selectedBlockContent: document.getElementById("selectedBlockContent"),
  legendTitle: document.getElementById("legend-title"),
  legendPanel: document.getElementById("legend-panel"),
  legendContent: document.getElementById("legend-content"),
  chartsPanel: document.getElementById("charts-panel"),
  toggleChartsBtn: document.getElementById("toggleChartsBtn"),
  sviTimeNote: document.getElementById("sviTimeNote"),
  isochronePromptNote: document.getElementById("isochronePromptNote"),
  metricChartMessage: document.getElementById("metricChartMessage"),
  scatterChartMessage: document.getElementById("scatterChartMessage")
  
};

document.addEventListener("DOMContentLoaded", async () => {
  initMap();
  initControls();
  initGeocoder();
  initModal();
  await loadBlocks();
  refreshView();
});

function initMap() {
  appState.map = L.map("map", {
    center: CONFIG.map.center,
    zoom: CONFIG.map.zoom,
    minZoom: CONFIG.map.minZoom,
    maxZoom: CONFIG.map.maxZoom,
    zoomControl: false
  });

  L.tileLayer(CONFIG.map.tileUrl, CONFIG.map.tileOptions).addTo(appState.map);

  L.control.scale({
    position: "bottomleft",
    imperial: true,
    metric: true
  }).addTo(appState.map);
}

function initModal() {
  const modalEl = document.getElementById("introModal");
  if (!modalEl || typeof bootstrap === "undefined") return;
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

function initControls() {
  dom.metricSelect.addEventListener("change", event => {
    appState.selectedMetric = event.target.value;
    refreshView();
  });

  dom.timeScenario.addEventListener("change", event => {
    appState.selectedTimePeriod = event.target.value;
    refreshView();
  });

  dom.choroplethMode.addEventListener("change", () => {
    if (dom.choroplethMode.checked) {
      returnToChoropleth();
    }
  });

  dom.isochroneMode.addEventListener("change", () => {
  if (!dom.isochroneMode.checked) return;

  appState.mode = "isochrone";
  refreshView();
});

  dom.clearSelectionBtn.addEventListener("click", returnToChoropleth);
  
  if (dom.toggleChartsBtn && dom.chartsPanel) {
  dom.toggleChartsBtn.addEventListener("click", () => {
    const isCollapsed = dom.chartsPanel.classList.toggle("collapsed");
    dom.chartsPanel.classList.toggle("expanded", !isCollapsed);
    dom.toggleChartsBtn.setAttribute("aria-expanded", String(!isCollapsed));
  });
}
}

function initGeocoder() {
  if (!L.Control.Geocoder) return;

  appState.geocoderControl = L.Control.geocoder({
    defaultMarkGeocode: false,
    placeholder: CONFIG.geocoder.placeholder,
    geocoder: L.Control.Geocoder.photon({
      geocodingQueryParams: {
        bbox: "-107.15,34.95,-106.35,35.35"
      }
    })
  }).on("markgeocode", event => {
    const latlng = event.geocode.center;
    handleGeocodeResult(latlng, event.geocode.name || "Address result");
  });

  const geocoderEl = appState.geocoderControl.onAdd(appState.map);
  dom.geocoderContainer.appendChild(geocoderEl);
}

async function loadBlocks() {
  try {
    const response = await fetch(CONFIG.data.blocksUrl);
    if (!response.ok) {
      throw new Error(`Failed to load block TopoJSON: ${response.status}`);
    }

    const topo = await response.json();
    const objectName = topo.objects[CONFIG.topojson.blockObjectName]
      ? CONFIG.topojson.blockObjectName
      : Object.keys(topo.objects)[0];

    const geojson = topojson.feature(topo, topo.objects[objectName]);
    appState.blocksGeoJSON = geojson;

    appState.blockLayer = L.geoJSON(geojson, {
      style: styleBlockFeature,
      onEachFeature: onEachBlockFeature
    }).addTo(appState.map);

    const bounds = appState.blockLayer.getBounds();
    if (bounds.isValid()) {
      appState.map.fitBounds(bounds, { padding: [20, 20] });
    }
  } catch (error) {
    console.error(error);
    dom.selectedBlockContent.innerHTML = `<p class="text-danger mb-0">Could not load block data.</p>`;
  }
}

function onEachBlockFeature(feature, layer) {
  layer.on({
    click: () => selectBlock(feature, layer),
    mouseover: () => {
      if (appState.mode === "choropleth") {
        layer.setStyle({ weight: 1.8, color: "#222222" });
      }
    },
    mouseout: () => {
      if (!appState.blockLayer) return;
      appState.blockLayer.resetStyle(layer);
    }
  });
}

function selectBlock(feature, layer = null) {
  appState.selectedFeature = feature;
  appState.selectedBlockId = getBlockId(feature);

  if (layer) {
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      // appState.map.panTo(bounds.getCenter());
    }
  }

  refreshView();
  openSelectedBlockPopup(feature);
}

function returnToChoropleth() {
  appState.mode = "choropleth";
  appState.selectedBlockId = null;
  appState.selectedFeature = null;

  clearIsochrone();
  appState.map.closePopup();

  if (appState.addressMarker) {
    appState.map.removeLayer(appState.addressMarker);
    appState.addressMarker = null;
  }

  dom.choroplethMode.checked = true;
  refreshView();
}

function refreshView() {
  if (!appState.blockLayer) return;

  if (appState.mode === "choropleth") {
    updateClassification();
  }

  appState.blockLayer.setStyle(styleBlockFeature);

  if (appState.mode === "choropleth") {
    clearIsochrone();
  } else {
    renderIsochroneForSelection();
  }

  updateLegend();
  updateCharts();
  updateSviTimeNote();
  updateIsochronePromptNote();

  if (appState.selectedFeature) {
    openSelectedBlockPopup(appState.selectedFeature);
  }
}


function styleBlockFeature(feature) {
  const isSelected = getBlockId(feature) === appState.selectedBlockId;

  if (appState.mode === "isochrone") {
    if (isSelected) {
      return { ...CONFIG.styles.selectedBlock };
    }
    return { ...CONFIG.styles.outline };
  }

  const value = getCurrentMetricValue(feature);
  return {
    ...CONFIG.styles.choropleth,
    fillColor: getColorForValue(value),
    weight: isSelected ? 2 : CONFIG.styles.choropleth.weight,
    color: isSelected ? "#111111" : CONFIG.styles.choropleth.color
  };
}

function getCurrentMetricValue(feature) {
  const metric = CONFIG.metrics[appState.selectedMetric];
  if (!metric) return null;

  if (metric.type === "static") {
    return safeNumber(feature.properties[metric.field]);
  }

  const fieldName = metric.fields[appState.selectedTimePeriod];
  return safeNumber(feature.properties[fieldName]);
}

function getColorForValue(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "#d9d9d9";
  }

  const breaks = appState.classification.breaks;

  if (!breaks.length) {
    return "#d9d9d9";
  }

  // SVI: no special zero class
  if (appState.selectedMetric === "svi") {
    for (let i = 0; i < breaks.length; i += 1) {
      if (value <= breaks[i]) {
        return CONFIG.colors[i];
      }
    }
    return CONFIG.colors[Math.min(breaks.length - 1, CONFIG.colors.length - 1)];
  }

  // Other metrics: preserve zero class
  if (value === 0) {
    return CONFIG.colors[0];
  }

  for (let i = 0; i < breaks.length; i += 1) {
    if (value <= breaks[i]) {
      return CONFIG.colors[i + 1];
    }
  }

  return CONFIG.colors[CONFIG.colors.length - 1];
}

function updateSviTimeNote() {
  if (!dom.sviTimeNote) return;

  if (appState.selectedMetric === "svi") {
    dom.sviTimeNote.classList.remove("hidden");
  } else {
    dom.sviTimeNote.classList.add("hidden");
  }
}

function updateIsochronePromptNote() {
  if (!dom.isochronePromptNote) return;

  if (appState.mode === "isochrone" && !appState.selectedBlockId) {
    dom.isochronePromptNote.classList.remove("hidden");
  } else {
    dom.isochronePromptNote.classList.add("hidden");
  }
}

function updateLegend() {
  if (!dom.legendPanel || !dom.legendContent) return;

  if (appState.mode !== "choropleth") {
    dom.legendPanel.classList.add("hidden");
    return;
  }
  
  if (dom.legendTitle) {
  dom.legendTitle.textContent = CONFIG.metrics[appState.selectedMetric].label;
  }
  
  dom.legendPanel.classList.remove("hidden");

  const values = appState.classification.values;
  const breaks = appState.classification.breaks;

  if (!breaks.length) {
    dom.legendContent.innerHTML = `<p class="mb-0 text-muted">No values available.</p>`;
    return;
  }

  const legendItems = [];

  // SVI: fixed equal-interval legend, no zero class
  if (appState.selectedMetric === "svi") {
    breaks.forEach((breakValue, index) => {
      const minValue = index === 0 ? 0.0 : breaks[index - 1];

      legendItems.push(`
        <div class="legend-item">
          <span class="legend-swatch" style="background:${CONFIG.colors[index]};"></span>
          <span>${formatLegendRange(minValue, breakValue)}</span>
        </div>
      `);
    });

    dom.legendContent.innerHTML = legendItems.join("");
    return;
  }

  // Other metrics: preserve zero class
  if (!values.length) {
    dom.legendContent.innerHTML = `<p class="mb-0 text-muted">No values available.</p>`;
    return;
  }

  legendItems.push(`
    <div class="legend-item">
      <span class="legend-swatch" style="background:${CONFIG.colors[0]};"></span>
      <span>0</span>
    </div>
  `);

  breaks.forEach((breakValue, index) => {
    const minValue = index === 0 ? values[0] : breaks[index - 1];

    legendItems.push(`
      <div class="legend-item">
        <span class="legend-swatch" style="background:${CONFIG.colors[index + 1]};"></span>
        <span>${formatLegendRange(minValue, breakValue)}</span>
      </div>
    `);
  });

  dom.legendContent.innerHTML = legendItems.join("");
}

function buildSelectedBlockPopupContent(feature) {
  if (!feature) {
    return `<p class="mb-0">No block selected.</p>`;
  }

  const metricConfig = CONFIG.metrics[appState.selectedMetric];
  const metricValue = getCurrentMetricValue(feature);
  const sviValue = safeNumber(feature.properties[CONFIG.metrics.svi.field]);
  const timeLabel = getTimeLabel(appState.selectedTimePeriod);

  if (appState.mode === "choropleth" && appState.selectedMetric === "svi") {
    return `
      <div class="popup-block-info">
        <p><strong>Social Vulnerability Index (SVI):</strong> ${CONFIG.metrics.svi.formatter(sviValue)}</p>
      </div>
    `;
  }

  return `
    <div class="popup-block-info">
      <p><strong>Time Period:</strong> ${timeLabel}</p>
      <p><strong>Metric:</strong> ${metricConfig.label}</p>
      <p><strong>Opportunities within 30-minutes:</strong> ${metricConfig.formatter(metricValue)}</p>
      <p><strong>Social Vulnerability Index (SVI):</strong> ${CONFIG.metrics.svi.formatter(sviValue)}</p>
    </div>
  `;
}

function openSelectedBlockPopup(feature) {
  if (!feature || !appState.blockLayer) return;

  let targetLayer = null;

  appState.blockLayer.eachLayer(layer => {
    if (getBlockId(layer.feature) === getBlockId(feature)) {
      targetLayer = layer;
    }
  });

  if (!targetLayer) return;

  targetLayer.bindPopup(buildSelectedBlockPopupContent(feature), {
    autoPan: true,
    maxWidth: 280
  }).openPopup();
}

async function renderIsochroneForSelection() {
  if (!appState.selectedBlockId) {
    clearIsochrone();
    return;
  }

  const scenarioKey = appState.selectedTimePeriod;

  try {
    const scenarioGeoJSON = await loadIsochroneScenario(scenarioKey);
    const selectedFeature = scenarioGeoJSON.features.find(feature => {
      return String(feature.properties[CONFIG.ids.blockIdField]) === String(appState.selectedBlockId);
    });

    clearIsochrone();

    if (!selectedFeature) return;

    appState.isochroneLayer = L.geoJSON(selectedFeature, {
      style: CONFIG.styles.isochrone,
      interactive: false
    }).addTo(appState.map);

    const bounds = appState.isochroneLayer.getBounds();
    if (bounds.isValid()) {
      appState.map.fitBounds(bounds, { padding: [60, 60] });
    }
  } catch (error) {
    console.error(`Could not render isochrone for ${scenarioKey}`, error);
    clearIsochrone();
  }
}

async function loadIsochroneScenario(scenarioKey) {
  if (appState.isochroneCache[scenarioKey]) {
    return appState.isochroneCache[scenarioKey];
  }

  const url = `${CONFIG.data.isochroneFolder}${scenarioKey}.topojson`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load isochrone file: ${url}`);
  }

  const topo = await response.json();
  const objectName = topo.objects[CONFIG.topojson.isochroneObjectName]
    ? CONFIG.topojson.isochroneObjectName
    : Object.keys(topo.objects)[0];

  const geojson = topojson.feature(topo, topo.objects[objectName]);
  appState.isochroneCache[scenarioKey] = geojson;
  return geojson;
}

function clearIsochrone() {
  if (appState.isochroneLayer) {
    appState.map.removeLayer(appState.isochroneLayer);
    appState.isochroneLayer = null;
  }
}

function handleGeocodeResult(latlng, label) {
  if (!appState.blocksGeoJSON) return;

  const point = turf.point([latlng.lng, latlng.lat]);
  const containingFeature = appState.blocksGeoJSON.features.find(feature => {
    try {
      return turf.booleanPointInPolygon(point, feature);
    } catch (error) {
      console.warn("Point-in-polygon check failed for a feature.", error);
      return false;
    }
  });

  if (!containingFeature) {
    dom.selectedBlockContent.innerHTML = `<p class="text-danger mb-0">Address could not be matched to a census block.</p>`;
    return;
  }

  if (appState.addressMarker) {
    appState.map.removeLayer(appState.addressMarker);
  }

  appState.addressMarker = L.circleMarker(latlng, {
    radius: 6,
    weight: 2,
    color: "#111111",
    fillColor: "#2563eb",
    fillOpacity: 1
  }).addTo(appState.map);

  //appState.addressMarker.bindPopup(`<strong>${escapeHtml(label)}</strong>`).openPopup();

  selectBlock(containingFeature);
}


function updateCharts() {
  const metricContainer = document.getElementById("metricChart");
  const scatterContainer = document.getElementById("scatterChart");

  if (metricContainer) {
    metricContainer.innerHTML = "";
  }

  if (scatterContainer) {
    scatterContainer.innerHTML = "";
  }

  appState.charts.metricChart = null;
  appState.charts.scatterChart = null;

  if (dom.metricChartMessage) {
    dom.metricChartMessage.classList.add("hidden");
    dom.metricChartMessage.textContent = "";
  }

  if (dom.scatterChartMessage) {
    dom.scatterChartMessage.classList.add("hidden");
    dom.scatterChartMessage.textContent = "";
  }

  // SVI selected: both chart areas show message
  if (appState.selectedMetric === "svi") {
    if (dom.metricChartMessage) {
      dom.metricChartMessage.textContent = "Change metric to see charts";
      dom.metricChartMessage.classList.remove("hidden");
    }

    if (dom.scatterChartMessage) {
      dom.scatterChartMessage.textContent = "Change metric to see charts";
      dom.scatterChartMessage.classList.remove("hidden");
    }

    return;
  }

  // Non-SVI metric but no block selected:
  // only bar chart gets a message, scatter still renders
  if (!appState.selectedFeature) {
    if (dom.metricChartMessage) {
      dom.metricChartMessage.textContent = "Select a block to see time period chart";
      dom.metricChartMessage.classList.remove("hidden");
    }

    updateScatterChart();
    return;
  }

  updateMetricChart();
  updateScatterChart();
}

function updateMetricChart() {
  const container = document.getElementById("metricChart");
  if (!container || typeof d3 === "undefined") return;

  container.innerHTML = "";

  if (!appState.selectedFeature) return;

  const metricConfig = CONFIG.metrics[appState.selectedMetric];
  if (metricConfig.type === "static") return;

  const customBarLabels = {
  weekday_peak: "Weekday 8AM",
  weekday_offpeak: "Weekday 2PM",
  weekday_evening: "Weekday 8PM",
  weekend_peak: "Weekend 8AM",
  weekend_offpeak: "Weekend 2PM",
  weekend_evening: "Weekend 8PM"
};

const data = CONFIG.timePeriods.map(period => {
  const field = metricConfig.fields[period.key];
  return {
    label: customBarLabels[period.key],
    value: safeNumber(appState.selectedFeature.properties[field]) || 0,
    key: period.key
  };
});

  const margin = { top: 10, right: 10, bottom: 55, left: 55 };
  const width = container.clientWidth || 320;
  const height = container.clientHeight || 220;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const xScale = d3
    .scaleBand()
    .domain(data.map(d => d.label))
    .range([0, innerWidth])
    .padding(0.2);

  const yMax = d3.max(data, d => d.value) || 0;

  const yScale = d3
    .scaleLinear()
    .domain([0, yMax === 0 ? 1 : yMax])
    .nice()
    .range([innerHeight, 0]);

  g.selectAll("rect")
  .data(data)
  .enter()
  .append("rect")
  .attr("x", d => xScale(d.label))
  .attr("y", d => yScale(d.value))
  .attr("width", xScale.bandwidth())
  .attr("height", d => innerHeight - yScale(d.value))
  .attr("fill", d => d.key === appState.selectedTimePeriod ? "#3182bd" : "#6baed6")
  .attr("stroke", d => d.key === appState.selectedTimePeriod ? "#111111" : "none")
  .attr("stroke-width", d => d.key === appState.selectedTimePeriod ? 2 : 0);

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale))
    .selectAll("text")
    .style("text-anchor", "end")
    .attr("dx", "-0.6em")
    .attr("dy", "0.15em")
    .attr("transform", "rotate(-20)");

  g.append("g")
    .call(d3.axisLeft(yScale));

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 52)
    .attr("text-anchor", "middle")
    .attr("fill", "#222")
    .style("font-size", "12px")
    .text("Time Period");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -43)
    .attr("text-anchor", "middle")
    .attr("fill", "#222")
    .style("font-size", "12px")
    .text(metricConfig.label);
}

function updateScatterChart() {
  const container = document.getElementById("scatterChart");
  if (!container || typeof d3 === "undefined" || typeof d3.hexbin === "undefined") return;

  container.innerHTML = "";

  if (!appState.blocksGeoJSON) return;

  const metricConfig = CONFIG.metrics[appState.selectedMetric];
  const field = metricConfig.type === "static"
    ? metricConfig.field
    : metricConfig.fields[appState.selectedTimePeriod];

  const rawPoints = appState.blocksGeoJSON.features
    .map(feature => ({
      x: safeNumber(feature.properties.SVI),
      y: safeNumber(feature.properties[field]),
      id: getBlockId(feature)
    }))
    .filter(point => point.x !== null && point.y !== null);

  if (!rawPoints.length) return;

  const selectedPoint = appState.selectedFeature
    ? {
        x: safeNumber(appState.selectedFeature.properties.SVI),
        y: safeNumber(appState.selectedFeature.properties[field])
      }
    : null;

  const margin = { top: 10, right: 16, bottom: 42, left: 52 };
  const width = container.clientWidth || 320;
  const height = container.clientHeight || 300;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const xExtent = d3.extent(rawPoints, d => d.x);
  const yExtent = d3.extent(rawPoints, d => d.y);

  const xPadding = (xExtent[1] - xExtent[0]) * 0.05 || 0.05;
  const yPadding = (yExtent[1] - yExtent[0]) * 0.05 || 1;

  const xScale = d3.scaleLinear()
    .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
    .range([0, innerWidth]);

  const yScale = d3.scaleLinear()
  .domain([0, yExtent[1] + yPadding])
  .nice()
  .range([innerHeight, 0]);

  const points = rawPoints.map(d => [xScale(d.x), yScale(d.y)]);

  const hexRadius = 9;
const hexBottomPad = 12;

const hexbin = d3.hexbin()
  .radius(hexRadius)
  .extent([[0, 0], [innerWidth, innerHeight - hexBottomPad]]);

  const bins = hexbin(points);

  const color = d3.scaleSequential()
    .domain([0, d3.max(bins, d => d.length) || 1])
    .interpolator(d3.interpolateBlues);

  g.append("g")
    .selectAll("path")
    .data(bins)
    .join("path")
    .attr("d", hexbin.hexagon())
    .attr("transform", d => `translate(${d.x},${d.y})`)
    .attr("fill", d => color(d.length))
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 0.5);

  if (selectedPoint && selectedPoint.x !== null && selectedPoint.y !== null) {
    g.append("circle")
      .attr("cx", xScale(selectedPoint.x))
      .attr("cy", yScale(selectedPoint.y))
      .attr("r", 5)
      .attr("fill", "#111111")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.5);
  }

  const xAxisOffset = 12;

g.append("g")
  .attr("transform", `translate(0,${innerHeight + xAxisOffset})`)
  .call(d3.axisBottom(xScale));

  g.append("g")
    .call(d3.axisLeft(yScale));

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 40)
    .attr("text-anchor", "middle")
    .attr("fill", "#222")
    .style("font-size", "12px")
    .text("SVI");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -43)
    .attr("text-anchor", "middle")
    .attr("fill", "#222")
    .style("font-size", "12px")
    .text(metricConfig.label);
}

// function getQuantileBreaks(sortedValues, classCount) {
//   const breaks = [];
//   if (!sortedValues.length) return breaks;

//   for (let i = 1; i <= classCount; i += 1) {
//     const index = Math.min(
//       sortedValues.length - 1,
//       Math.floor((i / classCount) * sortedValues.length) - 1
//     );
//     breaks.push(sortedValues[Math.max(index, 0)]);
//   }

//   return breaks;
// }

function updateClassification() {
  if (!appState.blocksGeoJSON) return;

  const allValues = appState.blocksGeoJSON.features
    .map(getCurrentMetricValue)
    .filter(v => v !== null && !Number.isNaN(v))
    .sort((a, b) => a - b);

  // SVI: fixed equal-interval classes, no separate zero class
  if (appState.selectedMetric === "svi") {
    appState.classification.values = allValues;
    appState.classification.breaks = [0.2, 0.4, 0.6, 0.8, 1.0];
    return;
  }

  // Other metrics: keep zero as its own class
  const nonZeroValues = allValues.filter(v => v > 0).sort((a, b) => a - b);

  appState.classification.values = nonZeroValues;

  if (!nonZeroValues.length) {
    appState.classification.breaks = [];
    return;
  }

  const classCount = CONFIG.colors.length - 1; // reserve first color for zero

  if (typeof ss !== "undefined" && nonZeroValues.length >= classCount) {
    try {
      appState.classification.breaks = ss.jenks(nonZeroValues, classCount).slice(1);
      return;
    } catch (error) {}
  }

  
}

function formatLegendRange(min, max) {
  if (min === null || max === null) return "No data";

  const decimals = appState.selectedMetric === "svi" ? 1 : 0;
  return `${formatNumber(min, decimals)} – ${formatNumber(max, decimals)}`;
}

function getBlockId(feature) {
  return feature?.properties?.[CONFIG.ids.blockIdField] ?? null;
}

function getTimeLabel(timeKey) {
  const match = CONFIG.timePeriods.find(period => period.key === timeKey);
  return match ? match.label : timeKey;
}

function safeNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);

  if (!Number.isFinite(number)) return null;

  // SVI "no data" values
  if (number === -999) return null;


  return number;
}

function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function escapeHtml(text) {
  if (typeof text !== "string") return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
