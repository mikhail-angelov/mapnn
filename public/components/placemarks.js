import { html, render, Component } from "../libs/htm.js";
import { loadPlacemarksLocal, savePlacemarksLocal } from "../storage.js";
import { isMobile, getId } from "../utils.js";
import { composeUrlLink } from "../urlParams.js";

export const createPlacemarksPanel = ({
  addPlacemark,
  removePlacemark,
  yandexMap,
}) => {
  const panel = { addItems: () => {} };

  let localItems = loadPlacemarksLocal();
  const init = localItems.map((p) => {
    const mapItem = addPlacemark(p);
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

  const PItem = ({ id, name, point, onRemove }) =>
    html`<li
      class="place-item"
      key="${id}"
      onClick=${() => yandexMap.setCenter([point.lat, point.lng])}
    >
      <div class="title">${name}</div>
      <${IconButton}
        icon="🔗"
        tooltips="Скопировать линк"
        onClick=${() => copyUrl([{ id, name, point }])}
      />
      <${IconButton}
        icon="╳"
        tooltips="Удалить все"
        onClick=${() => onRemove()}
      />
    </li>`;

  const IconButton = ({ icon, onClick, ...other }) =>
    html`<button class="icon-button" onClick=${onClick} ...${other}>
      ${icon}
    </button>`;

  class App extends Component {
    componentDidMount() {
      panel.addItems = this.addItems.bind(this);
      this.setState({ placemarks: this.props.init, showPanel: !isMobile() });
    }
    addItems(items) {
      const { placemarks } = this.state;
      const added = items.map(({ name, point }) => {
        const placemark = { id: getId(), name, point };
        const mapItem = addPlacemark(placemark);
        return { ...placemark, mapItem };
      });

      const updatedPlacemarks = [...placemarks, ...added];
      this.setState({ placemarks: updatedPlacemarks });
      savePlacemarksLocal(updatedPlacemarks);
    }

    removeItem(id, mapItem) {
      const { placemarks } = this.state;
      const updatedPlacemarks = placemarks.filter((p) => p.id !== id);
      removePlacemark(mapItem);
      this.setState({ placemarks: updatedPlacemarks });
      savePlacemarksLocal(updatedPlacemarks);
    }

    setShowPanel(value) {
      this.setState({ showPanel: value });
    }

    render({}, { placemarks = [], showPanel }) {
      return showPanel
        ? html` <div class="placemark">
                  <div class="header">
                    <div class="title">Метки</div>
                    <label class="upload" htmlFor="upload">⬇</label>
                    <input type="file" id="upload" onChange=${(e) =>
                      importPlacemarks(e.target.files)} hidden></input>
                    <${IconButton}
                      icon="⇪"
                      tooltip=""
                      onClick=${() => downloadPlacemarks(placemarks)}
                    />
                    <${IconButton}
                      icon="˅"
                      onClick=${() => this.setShowPanel(false)}
                    />
                  </div>
                  <ul class="list">
                    ${placemarks.map(
                      (p) =>
                        html`<${PItem}
                          ...${p}
                          onRemove=${() => this.removeItem(p.id, p.mapItem)}
                        />`
                    )}
                  </ul>
                </div>`
        : html`<${IconButton}
            class="icon-button placemark-icon"
            icon="⌘"
            onClick=${() => this.setShowPanel(true)}
          />`;
    }
  }

  render(html`<${App} init=${init} />`, document.getElementById("placemarks"));

  return panel;
};
