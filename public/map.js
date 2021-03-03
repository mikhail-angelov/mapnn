import { loadOpacity } from "./storage.js";
import { parseUrlParams } from "./urlParams.js";
import { createOpacitySlider } from "./components/opacitySlider.js";
import { createPlacemarksPanel } from "./components/placemarks.js";
import { getSecondMap } from "./components/secondMap.js";
import { isMobile } from "./utils.js";

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

  const centerObject = new ymaps.Placemark(
    yandexMap.getCenter(),
    {},
    {
      preset: "islands#geolocationIcon",
    }
  );
  yandexMap.geoObjects.add(centerObject);

  yandexMap.events.add("actionend", function (e) {
    const [lat, lng] = e.originalEvent.map.getCenter();
    const z = e.originalEvent.map.getZoom();
    // console.log("on actionend", z, lat, lng);
    secondMap.setCenter({ lat, lng });
    secondMap.setZoom(z - 1);
    centerObject.geometry.setCoordinates(yandexMap.getCenter());
    panel.refresh();
  });

  yandexMap.events.add("actiontick", function (e) {
    centerObject.geometry.setCoordinates(yandexMap.getCenter());
    const [lat, lng] = e.originalEvent.map.getCenter();
    const z = e.originalEvent.map.getZoom();
    // console.log("on tickend", z, lat, lng);
    secondMap.setCenter({ lat, lng });
    secondMap.setZoom(z - 1);
    centerObject.geometry.setCoordinates(yandexMap.getCenter());
  });

  yandexMap.onEditMark = ({ id, name, description='', point, onSubmit }) => {
    if (yandexMap.balloon.isOpen()) {
      yandexMap.balloon.close();
    }
    yandexMap.balloon
      .open([point.lat, point.lng], {
        contentHeader: `${id ? "Обновить метку" : "Добавить метку?"}`,
        contentBody: `<form id="onAdd"><p>Название: <input name="name" value="${name}"/></p>
        <p>Описание: <input name="description" value="${description}"/></p>
        <input name="point" value="${point.lat},${point.lng}" hidden/>
        <input name="id" value="${id}" hidden/>
        <p><sup>координаты: ${point.lat.toFixed(6)},${point.lng.toFixed(6)}
        </sup></p><button>${id ? "Сохранить" : "Добавить"}</button></form>`,
      })
      .then(() => {
        document.getElementById("onAdd").addEventListener("submit", onSubmit);
      });
  };
  yandexMap.addPlacemark = ({ name, description, point }) => {
    return addObject(name, description, [point.lat, point.lng], "main");
  };

  yandexMap.events.add("contextmenu", function (e) {
    if (!yandexMap.balloon.isOpen()) {
      const [lat, lng] = e.get("coords");
      yandexMap.onEditMark({
        name: "",
        description: "...",
        point: { lat, lng },
        onSubmit: addMapItem,
      });
    } else {
      const point = yandexMap.balloon.getPosition();
      yandexMap.setCenter(point);
      yandexMap.balloon.close();
    }
  });

  yandexMap.refreshMe = () => {
    yandexMap.container.fitToViewport();
    secondMap.resize();
  };

  createOpacitySlider("#ymap", opacity);
  marks.forEach((p) => addMark(p));
  const panel = createPlacemarksPanel({ yandexMap });

  if(isMobile()){
    document.getElementById("slider").setAttribute('class','map-overlay mobile')
  }else {
    document.getElementById("slider").setAttribute('class','map-overlay desktop')
  }

  function addMapItem(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const name = formData.get("name");
    const description = formData.get("description");
    const [lat, lng] = yandexMap.balloon.getPosition();
    yandexMap.balloon.close();
    panel.addItems([{ name, description, point: { lat, lng } }]);
  }

  function addObject(name, description = "", coords, type) {
    const placemark = new ymaps.Placemark(
      coords,
      {
        balloonContent: `<h4>${name}</h4>`,
        hintContent: `${name}:${description}`,
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
  function addMark({ name, description, point }) {
    return addObject(name, description, [point.lat, point.lng], "guest");
  }
});
