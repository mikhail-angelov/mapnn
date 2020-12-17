import { loadPlacemarksLocal, loadOpacity } from "./storage.js";
import { parseUrlParams } from "./urlParams.js";
import { createOpacitySlider } from "./components/opacitySlider.js";
import { createPlacemarksPanel } from "./components/placemarks.js";
import { getSecondMap } from "./components/secondMap.js";

let { zoom, center: position, opacity, placemarks: marks } = parseUrlParams();
const secondMap = getSecondMap(position, zoom);
opacity = opacity ? +opacity : loadOpacity();

ymaps.ready(() => {
  const yandexMap = new ymaps.Map(
    "ymap",
    {
      center: position.reverse(), // yandex point is in reverse order
      zoom: zoom + 1, // zoom is different by 1
      type: "yandex#hybrid",
    },
    {
      searchControlProvider: "yandex#search",
    }
  );

  yandexMap.events.add("actionend", function (e) {
    const [lat, lng] = e.originalEvent.map.getCenter();
    const z = e.originalEvent.map.getZoom();
    // console.log("on actionend", z, lat, lng);
    secondMap.setCenter({ lat, lng });
    secondMap.setZoom(z - 1);
  });
  yandexMap.events.add("actiontick", function (e) {
    const [lat, lng] = e.originalEvent.map.getCenter();
    const z = e.originalEvent.map.getZoom();
    // console.log("on tickend", z, lat, lng);
    secondMap.setCenter({ lat, lng });
    secondMap.setZoom(z - 1);
  });

  yandexMap.events.add("contextmenu", function (e) {
    if (!yandexMap.balloon.isOpen()) {
      const coords = e.get("coords");
      yandexMap.balloon
        .open(coords, {
          contentHeader: "Добавить метку?",
          contentBody: `<form id="onAdd"><p>Название: <input name="name"/><input name="coords" value=${coords.join(
            ", "
          )} hidden/></p>
            <p><sup>координаты: ${[
              coords[0].toPrecision(6),
              coords[1].toPrecision(6),
            ].join(", ")} 
            </sup></p><button>Добавить</button></form>`,
        })
        .then(() => {
          document
            .getElementById("onAdd")
            .addEventListener("submit", addMapItem);
        });
    } else {
      const point = yandexMap.balloon.getPosition();
      yandexMap.setCenter(point);
      yandexMap.balloon.close();
    }
  });

  createOpacitySlider("#ymap canvas", opacity);
  marks.forEach((p) => addMark(p));
  const panel = createPlacemarksPanel({
    addPlacemark,
    removePlacemark,
    yandexMap,
  });

  function addMapItem(e) {
    e.preventDefault();
    const name = e.target.name.value;
    const [lat, lng] = yandexMap.balloon.getPosition();
    yandexMap.balloon.close();
    panel.addItems([{ name, point: { lat, lng } }]);
  }

  function addObject(name, coords, type) {
    const placemark = new ymaps.Placemark(
      coords,
      {
        balloonContent: `<h4>${name}</h4>`,
        hintContent: `${coords.join(",")}`,
      },
      {
        preset:
          type === "guest"
            ? "islands#greenCircleDotIcon"
            : "islands#blueCircleDotIcon",
      }
    );
    yandexMap.geoObjects.add(placemark);
    return placemark;
  }
  function addMark({ name, point }) {
    return addObject(name, [point.lat, point.lng], "guest");
  }
  function addPlacemark({ name, point }) {
    return addObject(name, [point.lat, point.lng], "main");
  }
  function removePlacemark(mapItem) {
    if (mapItem) {
      yandexMap.geoObjects.remove(mapItem);
    }
  }
});
