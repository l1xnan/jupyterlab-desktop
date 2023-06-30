window.onload = () => {
  console.log("window onloaded");

  setTimeout(function () {
    var tmp = document.getElementById("jp-top-panel");
    console.log(tmp);
    tmp.setAttribute("data-tauri-drag-region", "");
  }, 5000);
};

document.addEventListener("DOMContentLoaded", (event) => {
  console.log("DOM fully loaded and parsed");
  setTimeout(function () {
    var tmp = document.getElementById("jp-top-bar");
    console.log(tmp);
    tmp.setAttribute("data-tauri-drag-region", "");
  }, 5000);
});
console.log("hello world from js init script");
