import Head from "../../components/home/head/index.js";
import Classification from "../../components/home/classification/index.js";
import Model from "../../components/home/model/index.js";
import Foot from "../../components/home/foot/index.js";

export default {
  name: "Home",
  components: {
    Head,
    Classification,
    Model,
    Foot,
  },
  data() {
    return {
      allList: [],
      searchParameter: {
        key: "",
        sort: "",
        level: "",
        tags: [],
      },
      isLoading: true,
      column: 0,
      columnIndex: 0,
      viewMode: "grid",
    };
  },
  computed: {
    selectedWidget() {
      return this.node?.CSgetSelModelWidget();
    },
    rendering() {
      return this.renderer?.rendering;
    },
  },
  watch: {
    nodeId: {
      handler() {
        this.allList = this.node?.CSgetModelLists() || [];
      },
      immediate: true,
    },
  },
  mounted() {
    this.columnIndex = JSON.parse(localStorage.getItem("columnIndex"));
    if (typeof this.columnIndex !== "number") {
      this.columnIndex = 3;
    }
    this.column = this.$t("home.head.sizeList")[this.columnIndex].value;
    this.viewMode = localStorage.getItem("viewMode") || "grid";
    this.$i18n.locale = this.$store.state.config.language;
    this.$store.commit("config/updateWindowing", this.$store.state.config.windowing);
    this.isLoading = false;
  },
  methods: {
    // Change the quantity displayed in a row
    changeColumn(value) {
      this.column = value;
    },
    // Change view mode (grid/list)
    changeViewMode(mode) {
      this.viewMode = mode;
    },
    // Change filtering criteria
    changeSearchParameter(value) {
      this.searchParameter = {
        ...this.searchParameter,
        ...value,
      };
    },
    // Refresh model list
    refreshModels() {
      try {
        const newList = this.node?.CSrefreshModelLists();
        this.allList = newList || [];
        // 刷新成功，显示成功提示
        this.$message(this.$t("home.head.refreshSuccess"));
      } catch (e) {
        console.error("Refresh models failed:", e);
        // 刷新失败，显示失败提示
        this.$message(this.$t("home.head.refreshFail"));
      }
    },
  },
  template: `<div v-if="!isLoading" class="home_page">
               <div class="content">
                <Head :column-index="columnIndex" :view-mode="viewMode" @changeSearchParameter="changeSearchParameter" @changeColumn="changeColumn" @changeViewMode="changeViewMode" @refreshModels="refreshModels" :all-list="allList" />
                <Classification @changeSearchParameter="changeSearchParameter" :all-list="allList" />
                <Model :column="column" :all-list="allList" :selected-widget="selectedWidget" :search-parameter="searchParameter" :view-mode="viewMode" />
              </div>
              <Foot :all-list="allList" v-show="rendering"/>
             </div>`,
};
