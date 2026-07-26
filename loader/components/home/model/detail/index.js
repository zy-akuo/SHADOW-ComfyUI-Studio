import { getLevelInf } from "../../../../static/js/public.js";
// import { api } from "/scripts/api.js";
import BasicInf from "./basicInf/index.js";
import Workflow from "./workflow/index.js";
import Note from "./note/index.js";
import IconRenderer from "../../../public/iconRenderer.js";

function getApi() {
  const api = window.comfyAPI?.api?.api || window.parent.comfyAPI?.api?.api;
  api.api_base = "";
  return api;
}

const MAX_EXPORT_EDGE = 1024;
const MAX_SCALE_RATIO = 4;

const ext = {
  is_rendering: false,
  name: "ComfyUI-Studio.model.detail",
  async register() {
    try {
      const { app } = await import("/scripts/app.js");
      app.registerExtension(ext);
    } catch (error) {
      // console.error(error);
    }
  },
};
ext.register();
export default {
  props: ["model"],
  components: {
    BasicInf,
    Workflow,
    Note,
  },
  data() {
    return {
      list: [],
      levelList: [],
      menuIndex: 0,
      isReadonly: true,
      selectedLevel: "D",
      defaultCover: "./static/image/default.jpg",
      cropping: false,
      cropSrc: "",
      cropNaturalW: 0,
      cropNaturalH: 0,
      scale: 1,
      minScale: 1,
      offsetX: 0,
      offsetY: 0,
      dragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragOriginX: 0,
      dragOriginY: 0,
      dragOver: false,
      cropConfirming: false,
    };
  },
  created() {
    this.getLevelColor();
  },
  beforeDestroy() {
    this.revokeCropSrc();
    this.unbindCropDragListeners();
  },
  watch: {
    model: {
      handler(newValue, oldValue) {
        this.selectedLevel = newValue?.level;
        if (oldValue && newValue && oldValue.name !== newValue.name) {
          this.cancelCrop();
        }
      },
      deep: true,
    },
  },
  computed: {
    cropImgStyle() {
      return {
        width: this.cropNaturalW + "px",
        height: this.cropNaturalH + "px",
        transform: `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale})`,
        transformOrigin: "0 0",
      };
    },
  },
  methods: {
    // Click to trigger name modification
    editName() {
      this.isReadonly = false;
      this.$nextTick(() => {
        this.$refs.nameInput.focus();
      });
    },
    nameInputKeyDown(e) {
      if (e.key === "Enter") {
        this.changeName(e);
      } else if (e.key === "Escape") {
        this.isReadonly = true;
        e.preventDefault();
        e.stopPropagation();
      }
    },
    // Submit a new name
    changeName(e) {
      e.preventDefault();
      this.isReadonly = true;
      const value = this.$refs.nameInput.value;
      if (value) {
        this.$emit("modifyName", this.model, value);
      }
    },
    // Trigger when the name input box blur
    blurInput() {
      this.isReadonly = true;
    },
    // Change level
    changeLevel(levelInf) {
      this.selectedLevel = levelInf.value;
      this.$emit("changeLevel", levelInf.value);
    },
    // Obtain the corresponding color based on the current level
    getLevelColor() {
      const list = ["S", "A", "B", "C", "D"];
      list.forEach((item) => {
        this.levelList.push(getLevelInf(item));
      });
      this.selectedLevel = this.model.level;
    },
    // Add a tag
    addTag(tagValue) {
      this.$emit("addTag", tagValue);
    },
    // Delete tag
    deleteTag(index) {
      this.$emit("deleteTag", index);
    },
    // Click to use
    useModel() {
      this.$emit("useModel", this.model);
    },
    // Click to delete model
    deleteModel() {
      this.$confirmBox({
        describe: this.$t("home.modelDetail.deleteConfirm"),
        refuseText: this.$t("confirmBox.refuseText"),
        acceptText: this.$t("confirmBox.acceptText"),
        accept: () => {
          this.$emit("deleteModel", this.model);
        },
        refuse: () => {},
      });
    },
    // Rendering an image
    renderPic() {
      if (this.model) {
        if (this.renderer?.rendering) {
          alert(this.$t("home.head.renderingAlert"));
          return;
        }
        this.renderer.render(this.node, [this.model]);
      }
    },
    // Click to trigger the image acquisition event
    modifyCover() {
      document.getElementById("file_input").click();
    },
    // Change cover image path — enter crop mode
    inputCover(e) {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      this.startCrop(file);
    },
    revokeCropSrc() {
      if (this.cropSrc && this.cropSrc.startsWith("blob:")) {
        URL.revokeObjectURL(this.cropSrc);
      }
      this.cropSrc = "";
    },
    getPreviewBoxSize() {
      const el = this.$refs.imgContainer;
      if (!el) return { w: 0, h: 0 };
      const rect = el.getBoundingClientRect();
      return { w: rect.width, h: rect.height };
    },
    clampOffset() {
      const { w: boxW, h: boxH } = this.getPreviewBoxSize();
      if (!boxW || !boxH) return;
      const dispW = this.cropNaturalW * this.scale;
      const dispH = this.cropNaturalH * this.scale;
      const minX = Math.min(0, boxW - dispW);
      const minY = Math.min(0, boxH - dispH);
      this.offsetX = Math.max(minX, Math.min(0, this.offsetX));
      this.offsetY = Math.max(minY, Math.min(0, this.offsetY));
    },
    initCropTransform() {
      const { w: boxW, h: boxH } = this.getPreviewBoxSize();
      if (!boxW || !boxH || !this.cropNaturalW || !this.cropNaturalH) return;
      this.minScale = Math.max(boxW / this.cropNaturalW, boxH / this.cropNaturalH);
      this.scale = this.minScale;
      this.offsetX = (boxW - this.cropNaturalW * this.scale) / 2;
      this.offsetY = (boxH - this.cropNaturalH * this.scale) / 2;
      this.clampOffset();
    },
    startCrop(file) {
      if (!file || !file.type?.startsWith("image")) {
        this.$message({
          type: "error",
          message: this.$t("home.modelDetail.crop.invalidImage"),
        });
        return;
      }
      this.revokeCropSrc();
      const src = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        this.cropNaturalW = img.naturalWidth;
        this.cropNaturalH = img.naturalHeight;
        this.cropSrc = src;
        this.cropping = true;
        this.dragOver = false;
        this.$nextTick(() => {
          this.initCropTransform();
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(src);
        this.$message({
          type: "error",
          message: this.$t("home.modelDetail.crop.invalidImage"),
        });
      };
      img.src = src;
    },
    cancelCrop() {
      this.unbindCropDragListeners();
      this.cropping = false;
      this.dragging = false;
      this.dragOver = false;
      this.cropConfirming = false;
      this.revokeCropSrc();
      this.cropNaturalW = 0;
      this.cropNaturalH = 0;
      this.scale = 1;
      this.minScale = 1;
      this.offsetX = 0;
      this.offsetY = 0;
    },
    getPointerPoint(e) {
      if (e.touches && e.touches.length) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      if (e.changedTouches && e.changedTouches.length) {
        return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
      }
      return { x: e.clientX, y: e.clientY };
    },
    onCropPointerDown(e) {
      if (!this.cropping || this.cropConfirming) return;
      if (e.cancelable) e.preventDefault();
      const pt = this.getPointerPoint(e);
      this.dragging = true;
      this.dragStartX = pt.x;
      this.dragStartY = pt.y;
      this.dragOriginX = this.offsetX;
      this.dragOriginY = this.offsetY;
      this.bindCropDragListeners();
    },
    onCropPointerMove(e) {
      if (!this.dragging) return;
      if (e.cancelable) e.preventDefault();
      const pt = this.getPointerPoint(e);
      this.offsetX = this.dragOriginX + (pt.x - this.dragStartX);
      this.offsetY = this.dragOriginY + (pt.y - this.dragStartY);
      this.clampOffset();
    },
    onCropPointerUp() {
      this.dragging = false;
      this.unbindCropDragListeners();
    },
    bindCropDragListeners() {
      this._onCropMove = (e) => this.onCropPointerMove(e);
      this._onCropUp = () => this.onCropPointerUp();
      window.addEventListener("mousemove", this._onCropMove);
      window.addEventListener("mouseup", this._onCropUp);
      window.addEventListener("touchmove", this._onCropMove, { passive: false });
      window.addEventListener("touchend", this._onCropUp);
    },
    unbindCropDragListeners() {
      if (this._onCropMove) {
        window.removeEventListener("mousemove", this._onCropMove);
        window.removeEventListener("touchmove", this._onCropMove);
        this._onCropMove = null;
      }
      if (this._onCropUp) {
        window.removeEventListener("mouseup", this._onCropUp);
        window.removeEventListener("touchend", this._onCropUp);
        this._onCropUp = null;
      }
    },
    onCropWheel(e) {
      if (!this.cropping || this.cropConfirming) return;
      e.preventDefault();
      const { w: boxW, h: boxH } = this.getPreviewBoxSize();
      if (!boxW || !boxH) return;
      const el = this.$refs.imgContainer;
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const oldScale = this.scale;
      const maxScale = this.minScale * MAX_SCALE_RATIO;
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      let nextScale = Math.min(maxScale, Math.max(this.minScale, oldScale * factor));
      if (nextScale === oldScale) return;
      // Keep the image point under cursor stable
      const imgX = (px - this.offsetX) / oldScale;
      const imgY = (py - this.offsetY) / oldScale;
      this.scale = nextScale;
      this.offsetX = px - imgX * nextScale;
      this.offsetY = py - imgY * nextScale;
      this.clampOffset();
    },
    onPreviewDragOver(e) {
      e.preventDefault();
      if (!this.cropping) this.dragOver = true;
    },
    onPreviewDragLeave(e) {
      if (e.currentTarget.contains(e.relatedTarget)) return;
      this.dragOver = false;
    },
    onPreviewDrop(e) {
      e.preventDefault();
      this.dragOver = false;
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      this.startCrop(file);
    },
    uploadCoverFile(file) {
      const body = new FormData();
      body.append("image", file);
      body.append("type", this.model.type);
      body.append("mtype", this.model.mtype);
      body.append("name", this.model.name);
      const api = getApi();
      api.fetchApi("/cs/upload_thumbnail", { method: "POST", body });
      const filepath = URL.createObjectURL(file);
      this.$emit("modifyCover", filepath);
    },
    async confirmCrop() {
      if (!this.cropping || this.cropConfirming) return;
      const { w: boxW, h: boxH } = this.getPreviewBoxSize();
      if (!boxW || !boxH) return;
      this.cropConfirming = true;
      try {
        const img = this.$refs.cropImg;
        if (!img || !img.complete) {
          throw new Error("image not ready");
        }
        let outW = Math.round(boxW);
        let outH = Math.round(boxH);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        outW = Math.round(outW * dpr);
        outH = Math.round(outH * dpr);
        const maxEdge = Math.max(outW, outH);
        if (maxEdge > MAX_EXPORT_EDGE) {
          const ratio = MAX_EXPORT_EDGE / maxEdge;
          outW = Math.max(1, Math.round(outW * ratio));
          outH = Math.max(1, Math.round(outH * ratio));
        }
        const sx = -this.offsetX / this.scale;
        const sy = -this.offsetY / this.scale;
        const sw = boxW / this.scale;
        const sh = boxH / this.scale;
        const canvas = document.createElement("canvas");
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
            "image/jpeg",
            0.92
          );
        });
        const file = new File([blob], "cover.jpg", { type: "image/jpeg" });
        this.uploadCoverFile(file);
        this.cancelCrop();
      } catch (error) {
        this.cropConfirming = false;
        alert(error);
      }
    },
    changeMenu(index) {
      this.menuIndex = index;
    },
  },
  template: `
            <div v-if="model" class="model_detail">
              <div
                ref="imgContainer"
                class="img_container"
                :class="{ cropping: cropping, drag_over: dragOver }"
                @dragover="onPreviewDragOver"
                @dragleave="onPreviewDragLeave"
                @drop="onPreviewDrop"
                @wheel.prevent="onCropWheel"
              >
                <img v-if="!cropping" :src="model.cover || defaultCover" />
                <div v-else class="crop_layer">
                  <img
                    ref="cropImg"
                    class="crop_img"
                    :src="cropSrc"
                    :style="cropImgStyle"
                    draggable="false"
                    @mousedown="onCropPointerDown"
                    @touchstart.prevent="onCropPointerDown"
                  />
                  <div class="crop_actions" @mousedown.stop @touchstart.stop>
                    <span class="crop_tip">{{ $t("home.modelDetail.crop.tip") }}</span>
                    <div class="crop_btns">
                      <button type="button" class="crop_cancel" @click="cancelCrop">{{ $t("home.modelDetail.crop.cancelText") }}</button>
                      <button type="button" class="crop_confirm" :disabled="cropConfirming" @click="confirmCrop">{{ $t("home.modelDetail.crop.confirmText") }}</button>
                    </div>
                  </div>
                </div>
                <div v-if="!cropping" class="option_group">
                  <span class="icon_container" @click="renderPic"><em class="iconfont icon-camera"></em></span>
                  <span class="block"></span>
                  <span class="icon_container" @click="modifyCover"><em class="iconfont icon-upload"></em></span>
                  <input type="file" id="file_input" accept="image/*" @change="inputCover($event)" />
                </div>
              </div>
              <div v-if="isReadonly" class="model_name_wrap">
                <p class="model_name_text" :title="model.name">{{model.name}}</p>
                <span class="edit_icon" @click="editName" title="点击编辑名称"><em class="iconfont icon-edit"></em></span>
              </div>
              <div v-else class="name_input">
                <input ref="nameInput" type="value" :value="model.name" @blur="blurInput"  @keydown="nameInputKeyDown"/>
                <span @mousedown="changeName($event)"><em class="iconfont icon-edit"></em></span> 
              </div>
              <div class="level_group">
                <span v-for="(item, index) in levelList" :key="index" class="level_item" :class="{selected:selectedLevel === item.value}" :style="{'--color':item.color}" @click="changeLevel(item)">{{item.value}}</span>
              </div>
              <div class="menu_tab">
                <div v-for="(item,index) in $t('home.modelDetail.menuTab')" :key="index" class="menu_item" :class="{'active_menu': index === menuIndex }" @click="changeMenu(index)">{{item.name}}</div>
              </div>
              <Workflow v-if="menuIndex === 0" :model="model" />
              <Note v-if="menuIndex === 1" :model="model" />
              <BasicInf v-if="menuIndex === 2"  @addTag="addTag" @deleteTag="deleteTag" :model="model" />
              <button class="use_button" @click="useModel">{{$t("home.modelDetail.useButtonText")}}</button>
              <button class="delete_button" @click="deleteModel">{{$t("home.modelDetail.deleteButtonText")}}</button>
          </div>
  `,
};
