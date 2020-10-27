//
// Setup the EPSG:27700 (British National Grid) projection
//
var crs = new L.Proj.CRS(
    'EPSG:27700',
    "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.999601 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.060,0.1502,0.2470,0.8421,-20.4894 +datum=OSGB36 +units=m +no_defs",
    {
        transformation: new L.Transformation(1, 238375, -1, 1376256),
        resolutions: [896.0, 448.0, 224.0, 112.0, 56.0, 28.0, 14.0, 7.0, 3.5, 1.75, 0.875, 0.4375, 0.21875, 0.109375],
    });

var map;
let geoJsonLayer;
let allDeathData;
const startDate = moment('2020-03-02');
let date = moment('2020-03-02');
// let date = '2020-10-10';
setupLayer();

async function setupLayer() {
    if(map) {
        map.remove();
    }

    var key = 'GqQpJrSmtyWgdetbzAzkfs5FAwiq5OkQ';
    var style = 'Light 27700';

    
    // Set up default view options for EPSG:3857
    var tileMatrix = 'EPSG:3857';
    var mapOptions = {
        maxZoom: 20,
        minZoom: 7,
        center: [51.507222, -0.1275],
        maxBounds: [[49, -6.5],[61, 2.3]],
        zoom: 10
    };
    
    // Make some specific changes relevant to EPSG:27700 only
    if(style.indexOf('27700') !== -1) {
        tileMatrix = 'EPSG:27700';
        mapOptions.crs = crs;
        mapOptions.maxZoom = 13;
        mapOptions.minZoom = 0;
        mapOptions.zoom = 0;
    }
    
    // Set up the main url parameters
    var url = 'https://api.os.uk/maps/raster/v1/wmts';
    var parameters = {
        key: key,
        tileMatrixSet: encodeURI(tileMatrix),
        version: '1.0.0',
        style: 'default',
        layer: encodeURI(style),
        service: 'WMTS',
        request: 'GetTile',
        tileCol: '{x}',
        tileRow: '{y}',
        tileMatrix: '{z}',
    };
    let parameterString = Object.keys(parameters)
        .map(function(key) { return key + '=' + parameters[key]; })
        .join('&');
    var layer =  new L.TileLayer(
        url + '?' + parameterString,
        {
            // Add appropriate attribution
            attribution: '&copy; <a href="http://www.ordnancesurvey.co.uk/">Ordnance Survey</a>',
            maxZoom: 20
        }
    );
    
    mapOptions.layers = layer;
    // Create the map object and connect it to the 'map' element in the html
    map = L.map('map', mapOptions);

    const regionGeoJSON = 'https://opendata.arcgis.com/datasets/15f49f9c99ae4a16a6a5134258749b8a_0.geojson';
    const response = await fetch(regionGeoJSON);
    const geoJSON = await response.json();
    geoJsonLayer = new L.geoJSON(geoJSON, {onEachFeature: mouseEventListeners}).addTo(map);

    allDeathData = await getDeathsData();

    styleLayersOnDate();
    info.addTo(map);
    legend.addTo(map);
}


const styleLayersOnDate = () =>{

    geoJsonLayer.eachLayer((layer) =>{
        const layerName = layer.feature.properties.rgn19nm;
        const deaths = allDeathData.filter(regionData => {
            let regionMatch = regionData.areaName === layerName;
            let covidDate = moment(regionData.date);
            let dateMatch = covidDate.isSame(date);
            return regionMatch && dateMatch;
        });
        layer.feature.properties.deaths = !(deaths) || (deaths.length == 0) ? [{areaName: layerName, date: `${date.format('YYYY-MM-DD')}`, newDeaths28DaysByDeathDate: 0 }] : deaths;
        layer.setStyle(getStyle(layer));
    });


};

const getDeathsData = async () => {
    const covidDataUrl = 'https://api.coronavirus.data.gov.uk/v1/data?filters=areaType=region&structure={"date":"date","areaName":"areaName","newDeaths28DaysByDeathDate":"newDeaths28DaysByDeathDate"}';
    const response = await fetch(covidDataUrl);
    const json = await response.json();

    return json.data;
}

const getColour = d => {
    return  d > 200 ? '#0a0000' :
            d > 150 ? '#270009' :
            d > 130 ? '#450013' :
            d > 110 ? '#62001C' :
            d > 95  ? '#800026' :
            d > 80  ? '#9F1327' :
            d > 65  ? '#BE2728' :
            d > 50  ? '#DD3A29' :
            d > 35  ? '#FC4E2A' :
            d > 30  ? '#FC6D33' :
            d > 25  ? '#FD8D3C' :
            d > 20  ? '#FDA64F' :
            d > 15  ? '#FDBF62' :
            d > 10  ? '#FED976' :
            d > 5   ? '#FEE5A0' :
            d > 0   ? '#FEF2CA' :
                      '#FFFFF4';
}

const getStyle = layer => {
    return {
        fillColor: getColour(layer.feature.properties.deaths[0].newDeaths28DaysByDeathDate),
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.7
    };
}

// Event listeners
const highlightFeature = e => {
    const layer = e.target;

    layer.setStyle({
        weight: 5,
        color: '#666',
        dashArray: '',
        fillOpacity: 0.7
    });

    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layer.bringToFront();
    }

    info.update(layer.feature.properties.deaths[0]);
}

const resetHighlight = e => {
    e.target.setStyle(getStyle(e.target));
    info.update();
    // geoJsonLayer.resetStyle(e.target);
}

const zoomToFeature = e => {
    map.fitBounds(e.target.getBounds());
}

const mouseEventListeners = (feature, layer) => {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: zoomToFeature
    });
}

// Info Window
const info = L.control();

info.onAdd = function (map) {
    this._div = L.DomUtil.create('div', 'info'); // create a div with a class "info"
    this.update();
    return this._div;
};

// method that we will use to update the control based on feature properties passed
info.update = function (props) {
    // this._div.innerHTML = `<h4>Covid Deaths on ${props.date}</h4>`
    this._div.innerHTML = (props ?
        `<h4>Covid Deaths on ${props.date}</h4><b> ${props.areaName}</b><br /> ${props.newDeaths28DaysByDeathDate} people`
        : 'Hover over a region');
};

// Legend
var legend = L.control({position: 'bottomright'});

legend.onAdd = function (map) {

    var div = L.DomUtil.create('div', 'info legend'),
        grades = [0, 5, 10, 15, 20, 25, 30, 35, 50, 65, 80, 95, 110, 130, 150],
        labels = [];

    // loop through our density intervals and generate a label with a colored square for each interval
    for (var i = 0; i < grades.length; i++) {
        div.innerHTML +=
            '<i style="background:' + getColour(grades[i] + 1) + '"></i> ' +
            grades[i] + (grades[i + 1] ? '&ndash;' + grades[i + 1] + '<br>' : '+');
    }

    return div;
};

//Slider
var slider = document.getElementById("myRange");
var output = document.getElementById("demo");
var button = document.getElementById("play");
output.innerHTML = startDate.format('YYYY-MM-DD');

slider.oninput = function() {
    date = getDateXDaysFromStartDate(this.value);
    styleLayersOnDate();
    output.innerHTML = date.format('YYYY-MM-DD');
};

button.onclick = () =>{

    let interval = setInterval(() => {
        slider.value = parseInt(slider.value) + 1;
        slider.oninput();
        if(slider.value === '237'){
            clearInterval(interval);
        }
    }, 200);



};


const getDateXDaysFromStartDate = (days) =>{
    var newDate = moment(startDate);
    newDate.add(days, 'd');
    return newDate
};
