import { Loader2 } from "lucide-react"
const LoadingScreen = () => {
  return (
    <main className="w-screen h-screen flex items-center justify-center">
      <Loader2 className="animate-spin" />
    </main>
  )
}
export default LoadingScreen
