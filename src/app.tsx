import EditorLayout from "@/components/layout/editor-layout"
import { Toaster } from "@/components/ui/toaster"
import ProjectHubPage from "@/pages/project-hub-page"
import useAppStore from "@/stores/app-store"
import { type FC, Fragment } from "react"

const App: FC = () => {
  const {
    computed: { isProjectSelected },
  } = useAppStore()
  if (!isProjectSelected) {
    return (
      <Fragment>
        <ProjectHubPage />
        <Toaster />
      </Fragment>
    )
  }
  return (
    <Fragment>
      <EditorLayout />
      <Toaster />
    </Fragment>
  )
}
export default App
