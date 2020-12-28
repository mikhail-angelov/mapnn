import { html, render, Component } from "../libs/htm.js";
import { loadPlacemarksLocal, savePlacemarksLocal } from "../storage.js";
import { isMobile, getId, delay } from "../utils.js";
import { composeUrlLink } from "../urlParams.js";

export const createPlacemarksPanel = ({ yandexMap }) => {
  const panel = { addItems: () => {}, refresh: () => {} };

  let localItems = loadPlacemarksLocal();
  const init = localItems.map((p) => {
    const mapItem = yandexMap.addPlacemark(p);
    return { ...p, mapItem };
  });

  const copyUrl = async (items) => {
    const text = composeUrlLink({
      zoom: yandexMap.getZoom() - 1,
      center: yandexMap.getCenter().reverse(),
      opacity: 100,
      placemarks: items,
    });
    try {
      await navigator.clipboard.writeText(text);
      alert(`${text} is copied`);
    } catch (e) {
      console.log(e);
      alert(`error copy ${e}`);
    }
  };
  const downloadPlacemarks = (items) => {
    const toSore = items.map((p) => ({
      id: p.id,
      name: p.name,
      point: p.point,
    }));
    const file = new Blob([JSON.stringify(toSore)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = "poi.json";
    a.click();
  };
  const importPlacemarks = (files) => {
    if (files.length === 0) {
      console.log("No file is selected");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        const items = data
          .filter(
            (item) =>
              item &&
              item.name &&
              item.point &&
              item.point.lat &&
              item.point.lng
          )
          .map(({ name, point }) => ({ name, point }));
        panel.addItems(items);
      } catch (e) {
        console.log("File content error:", e);
      }
    };
    reader.readAsText(files[0]);
  };

  const formatDistance = (distance) => {
    const d = Math.round(distance || 0);
    return d > 800 ? `${(d / 1000).toFixed(2)} км` : `${d} м`;
  };

  const PItem = ({ id, name, point, distance, onRemove, onEdit }) =>
    html`<li
      class="place-item"
      key="${id}"
      onClick=${() => yandexMap.setCenter([point.lat, point.lng])}
    >
      <div class="title">
        <div>${name}</div>
        <div class="sub-title">${formatDistance(distance)}</div>
      </div>
      <${IconButton}
        icon="assets/link.svg"
        tooltips="Скопировать линк"
        onClick=${() => copyUrl([{ id, name, point }])}
      />
      <${IconButton}
        icon="assets/edit.svg"
        tooltips="Редактировать линк"
        onClick=${() => onEdit([{ id, name, point }])}
      />
      <${IconButton}
        icon="assets/remove.svg"
        tooltips="Удалить все"
        onClick=${() => onRemove()}
      />
    </li>`;

  const IconButton = ({ icon, onClick, ...other }) =>
    html`<button class="icon-button" onClick=${onClick} ...${other}>
      <img src=${icon}></img>
    </button>`;

  class App extends Component {
    componentDidMount() {
      panel.addItems = this.addItems.bind(this);
      panel.refresh = this.refresh.bind(this);
      this.setShowPanel(!isMobile());
      this.setState({
        placemarks: this.props.init,
        showPanel: !isMobile(),
        refresh: Date.now(),
      });
    }

    refresh() {
      this.setState({ refresh: Date.now() });
    }

    addItems(items) {
      const { placemarks } = this.state;
      const added = items.map(({ name, description, point }) => {
        const placemark = { id: getId(), name, description, point };
        const mapItem = yandexMap.addPlacemark(placemark);
        return { ...placemark, mapItem };
      });

      const updatedPlacemarks = [...placemarks, ...added];
      this.setState({ placemarks: updatedPlacemarks });
      savePlacemarksLocal(updatedPlacemarks);
    }

    removeItem(id, mapItem) {
      const { placemarks } = this.state;
      const updatedPlacemarks = placemarks.filter((p) => p.id !== id);
      if (mapItem) {
        yandexMap.geoObjects.remove(mapItem);
      }
      this.setState({ placemarks: updatedPlacemarks });
      savePlacemarksLocal(updatedPlacemarks);
    }

    onEdit(p) {
      yandexMap.onEditMark({
        ...p,
        onSubmit: (e) => {
          e.preventDefault();
          yandexMap.balloon.close();
          const formData = new FormData(e.target);
          const id = formData.get("id");
          const name = formData.get("name");
          const description = formData.get("description");
          const { placemarks } = this.state;
          const updatedPlacemarks = placemarks.map((p) =>
            p.id === id ? { ...p, name, description } : p
          );
          this.setState({ placemarks: updatedPlacemarks });
          savePlacemarksLocal(updatedPlacemarks);
        },
      });
    }

    setShowPanel(value) {
      this.setState({ showPanel: value }, () => {
        delay(800, () => yandexMap.refreshMe()); // hack to let containers resize, then resize map
      });
    }

    formatPlacemarks(placemarks) {
      const center = yandexMap.getCenter();
      const items = placemarks
        .map((item) => {
          const distance = ymaps.coordSystem.geo.getDistance(center, [
            item.point.lat,
            item.point.lng,
          ]);
          return { ...item, distance };
        })
        .sort((a, b) => a.distance - b.distance);
      return items;
    }

    render({}, { placemarks = [], showPanel }) {
      const items = this.formatPlacemarks(placemarks);
      return showPanel
        ? html` <div class="placemark">
                  <div class="header">
                    <div class="title">Метки</div>
                    <${IconButton}
                      icon="assets/close.svg"
                      onClick=${() => this.setShowPanel(false)}
                    />
                  </div>
                  <ul class="list">
                    ${items.map(
                      (p) =>
                        html`<${PItem}
                          ...${p}
                          onRemove=${() => this.removeItem(p.id, p.mapItem)}
                          onEdit=${() => this.onEdit(p)}
                        />`
                    )}
                  </ul>
                  <div class="footer">
                  <div class="import-export">
                    <label class="upload" htmlFor="upload">
                    Импорт
                    </label>
                    <input type="file" id="upload" onChange=${(e) =>
                      importPlacemarks(e.target.files)} hidden></input>
                    <button class="icon-button" onClick=${() =>
                      downloadPlacemarks(placemarks)}>
                      Экспорт
                    </button>
                  </div>
                  <a class="link" href="http://www.etomesto.ru/">карты c etomesto.ru</a>
                  <a class="link" href="https://github.com/mikhail-angelov/mapnn">
                  <img src="assets/github.svg"></img>исходники
                  </a>
                  </div>
                </div>`
        : html`<${IconButton}
            class="icon-button placemark-icon"
            icon="assets/place.svg"
            onClick=${() => this.setShowPanel(true)}
          />`;
    }
  }

  render(html`<${App} init=${init} />`, document.getElementById("placemarks"));

  return panel;
};
