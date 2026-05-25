import { getLevelInf } from "../../../../static/js/public.js";

export default {
  props: ["curList", "selectedModel", "column", "viewMode"],
  data() {
    return {
      defaultCover: "./static/image/default.jpg",
    };
  },
  mounted() {},
  methods: {
    useModel(model) {
      this.$emit("useModel", model);
    },
    changeModel(model) {
      this.$emit("changeSelectedModel", model);
    },
    levelInf(level) {
      return getLevelInf(level).color || "#808080";
    },
    formatSize(bytes) {
      if (!bytes || bytes <= 0) return "";
      if (bytes < 1024) return bytes + "B";
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + "KB";
      if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + "MB";
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + "GB";
    },
  },
  template: `
              <div v-if="viewMode === 'grid'" class="model_list" :style="{'--column':column}">
                  <div v-for="(item,index) in curList" :key="index" class="model_item" :class="{'selected':item === selectedModel}" @click="changeModel(item)" @dblclick="useModel(item)">
                      <div class="img_container" :style="{'--height': (73.05 - (column * 0.55)) / column + 'vw' }">
                         <img :src="item.cover || defaultCover" alt="cover" loading="lazy" />
                      </div>
                      <div class="model_des" :style="{'--height':6 / column * 3 + 'vw'}">
                          <div class="level" :style="{'background':levelInf(item.level)}">{{item.level}}</div>
                          <div class="text_des">
                              <p class="model_name_text" :title="item.name">{{item.name}}</p>
                              <p class="model_type_text" :title="item.type">{{item.type}}</p>
                          </div>
                      </div>
                  </div>
              </div>
              <div v-else class="model_list_view" :style="{'--column':column}">
                  <div v-for="(item,index) in curList" :key="'list-'+index" class="list_item" :class="{'selected':item === selectedModel}" @click="changeModel(item)" @dblclick="useModel(item)">
                      <div class="list_level" :style="{'background':levelInf(item.level)}">{{item.level}}</div>
                      <div class="list_name" :title="item.name">{{item.name}}</div>
                      <div class="list_type">{{item.type}}</div>
                      <div class="list_size">{{formatSize(item.size)}}</div>
                  </div>
              </div>
  `,
};
