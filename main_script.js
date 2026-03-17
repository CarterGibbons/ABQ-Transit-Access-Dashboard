// =========================================================
// Transit Accessibility Web Map
// =========================================================
// Assumptions:
// - Block TopoJSON file: data/blocks.topojson
// - Block TopoJSON object name: layer
// - Block ID field: GISJOIN
// - SVI field: SVI
// - Accessibility values live in the block properties.
// - Isochrones are stored separately in data/isochrones/
//   with one TopoJSON file per time scenario only:
//     weekday_peak.topojson
//     weekday_offpeak.topojson
//     weekday_evening.topojson
//     weekend_peak.topojson
//     weekend_offpeak.topojson
//     weekend_evening.topojson
// - Each isochrone feature has a GISJOIN property matching the block layer.
// - Metric selection affects choropleth styling and displayed values,
//   but NOT which isochrone file is used.
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
    zoom: 11,
    minZoom: 9,
    maxZoom: 19,
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
    { key: "weekday_peak", label: "Weekday Peak" },
    { key: "weekday_offpeak", label: "Weekday Off-Peak" },
    { key: "weekday_evening", label: "Weekday Evening" },
    { key: "weekend_peak", label: "Weekend Peak" },
    { key: "weekend_offpeak", label: "Weekend Off-Peak" },
    { key: "weekend_evening", label: "Weekend Evening" }
  ],

  colors: ["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#3182bd", "#08519c"],

  styles: {
    choropleth: {
      color: "#666666",
      weight: 0.7,
      fillOpacity: 0.82
    },
    outline: {
      color: "#8a8a8a",
      weight: 0.7,
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
  legendContent: document.getElementById("legend-content")
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
    zoomControl: true
  });

  L.tileLayer(CONFIG.map.tileUrl, CONFIG.map.tileOptions).addTo(appState.map);
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

    if (!appState.selectedBlockId) {
      dom.choroplethMode.checked = true;
      appState.mode = "choropleth";
      return;
    }

    appState.mode = "isochrone";
    refreshView();
  });

  dom.clearSelectionBtn.addEventListener("click", returnToChoropleth);
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
  appState.mode = "isochrone";
  dom.isochroneMode.checked = true;

  if (layer) {
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      appState.map.fitBounds(bounds, { padding: [60, 60] });
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

  appState.blockLayer.setStyle(styleBlockFeature);

  if (appState.mode === "choropleth") {
    clearIsochrone();
  } else {
    renderIsochroneForSelection();
  }

  updateLegend();
  updateCharts();

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

  const values = appState.blocksGeoJSON.features
    .map(getCurrentMetricValue)
    .filter(v => v !== null && !Number.isNaN(v))
    .sort((a, b) => a - b);

  if (!values.length) {
    return "#d9d9d9";
  }

  const breaks = getQuantileBreaks(values, CONFIG.colors.length);

  for (let i = 0; i < breaks.length; i += 1) {
    if (value <= breaks[i]) {
      return CONFIG.colors[i];
    }
  }

  return CONFIG.colors[CONFIG.colors.length - 1];
}

function updateLegend() {
  if (appState.mode === "isochrone") {
    dom.legendContent.innerHTML = `
      <div class="legend-item">
        <span class="legend-swatch" style="background:#ffffff;border:2px solid #111111;"></span>
        <span>Selected block</span>
      </div>
      <div class="legend-item">
        <span class="legend-swatch" style="background:#60a5fa;border:1px solid #2563eb;"></span>
        <span>30-minute isochrone</span>
      </div>
    `;
    return;
  }

  const values = appState.blocksGeoJSON.features
    .map(getCurrentMetricValue)
    .filter(v => v !== null && !Number.isNaN(v))
    .sort((a, b) => a - b);

  if (!values.length) {
    dom.legendContent.innerHTML = `<p class="mb-0 text-muted">No values available.</p>`;
    return;
  }

  const breaks = getQuantileBreaks(values, CONFIG.colors.length);
  const legendItems = breaks.map((breakValue, index) => {
    const minValue = index === 0 ? values[0] : breaks[index - 1];
    return `
      <div class="legend-item">
        <span class="legend-swatch" style="background:${CONFIG.colors[index]};"></span>
        <span>${formatLegendRange(minValue, breakValue)}</span>
      </div>
    `;
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
  const blockId = getBlockId(feature);
  const timeLabel = getTimeLabel(appState.selectedTimePeriod);

  return `
    <div class="popup-block-info">
      <p><strong>Block ID:</strong> ${blockId || "N/A"}</p>
      <p><strong>Metric:</strong> ${metricConfig.label}</p>
      <p><strong>Time Scenario:</strong> ${timeLabel}</p>
      <p><strong>Selected Value:</strong> ${metricConfig.formatter(metricValue)}</p>
      <p><strong>SVI:</strong> ${CONFIG.metrics.svi.formatter(sviValue)}</p>
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
      style: CONFIG.styles.isochrone
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
    fillColor: "#ffffff",
    fillOpacity: 1
  }).addTo(appState.map);

  //appState.addressMarker.bindPopup(`<strong>${escapeHtml(label)}</strong>`).openPopup();

  selectBlock(containingFeature);
}

function updateCharts() {
  updateMetricChart();
  updateScatterChart();
}

function updateMetricChart() {
  const canvas = document.getElementById("metricChart");
  if (!canvas || typeof Chart === "undefined") return;

  if (appState.charts.metricChart) {
    appState.charts.metricChart.destroy();
    appState.charts.metricChart = null;
  }

  if (!appState.selectedFeature) return;

  const metricConfig = CONFIG.metrics[appState.selectedMetric];

  if (metricConfig.type === "static") {
    return;
  }

  const labels = CONFIG.timePeriods.map(period => period.label);
  const values = CONFIG.timePeriods.map(period => {
    const field = metricConfig.fields[period.key];
    return safeNumber(appState.selectedFeature.properties[field]) || 0;
  });

  appState.charts.metricChart = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: metricConfig.label,
          data: values,
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function updateScatterChart() {
  const canvas = document.getElementById("scatterChart");
  if (!canvas || typeof Chart === "undefined") return;

  if (appState.charts.scatterChart) {
    appState.charts.scatterChart.destroy();
    appState.charts.scatterChart = null;
  }

  if (!appState.blocksGeoJSON) return;

  const metricConfig = CONFIG.metrics[appState.selectedMetric];
  const field = metricConfig.type === "static"
    ? metricConfig.field
    : metricConfig.fields[appState.selectedTimePeriod];

  const allPoints = appState.blocksGeoJSON.features
    .map(feature => ({
      x: safeNumber(feature.properties.SVI),
      y: safeNumber(feature.properties[field]),
      id: getBlockId(feature)
    }))
    .filter(point => point.x !== null && point.y !== null);

  const selectedPoint = appState.selectedFeature
    ? [{
        x: safeNumber(appState.selectedFeature.properties.SVI),
        y: safeNumber(appState.selectedFeature.properties[field])
      }]
    : [];

  appState.charts.scatterChart = new Chart(canvas.getContext("2d"), {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "All Blocks",
          data: allPoints,
          pointRadius: 3,
          pointHoverRadius: 5
        },
        {
          label: "Selected Block",
          data: selectedPoint,
          pointRadius: 6,
          pointHoverRadius: 7
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: {
            display: true,
            text: "SVI"
          }
        },
        y: {
          title: {
            display: true,
            text: metricConfig.label
          }
        }
      }
    }
  });
}

function getQuantileBreaks(sortedValues, classCount) {
  const breaks = [];
  if (!sortedValues.length) return breaks;

  for (let i = 1; i <= classCount; i += 1) {
    const index = Math.min(
      sortedValues.length - 1,
      Math.floor((i / classCount) * sortedValues.length) - 1
    );
    breaks.push(sortedValues[Math.max(index, 0)]);
  }

  return breaks;
}

function formatLegendRange(min, max) {
  if (min === null || max === null) return "No data";
  return `${formatNumber(min, 0)} – ${formatNumber(max, 0)}`;
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

  // Treat sentinel no-data values as null
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
