import ProjectHubScreen from "@/screens/project-hub-screen/project-hub-screen";
import useAppStore from "./stores/app-store";
import MainStack from "@/screens/main-stack/main-stack";
import PreviewSettingsWindow from "@/screens/preview-settings-window/preview-settings-window";

function App() {
  const windowMode = new URLSearchParams(window.location.search).get("window");
  const {
    computed: { isProjectSelected }
  } = useAppStore();

  if (windowMode === "preview-settings") {
    return <PreviewSettingsWindow />;
  }

  if (!isProjectSelected) {
    return <ProjectHubScreen />;
  }

  return <MainStack />;
}

export default App;
