import ProjectHubScreen from "@/screens/project-hub-screen/project-hub-screen";
import useAppStore from "./stores/app-store";
import MainStack from "@/screens/main-stack/main-stack";
import { Toaster } from "@/components/ui/toaster";

function App() {
  const {
    computed: { isProjectSelected }
  } = useAppStore();

  const screen = !isProjectSelected ? <ProjectHubScreen /> : <MainStack />;

  return (
    <>
      {screen}
      <Toaster />
    </>
  );
}

export default App;
