import ProjectHubScreen from "@/screens/project-hub-screen/project-hub-screen";
import useAppStore from "./stores/app-store";
import MainStack from "@/screens/main-stack/main-stack";

function App() {
  const {
    computed: { isProjectSelected }
  } = useAppStore();

  if (!isProjectSelected) {
    return <ProjectHubScreen />;
  }

  return <MainStack />;
}

export default App;
