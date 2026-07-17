import appStore from "@/stores/app-store";

export default class BaseService {
  protected getPath(): string {
    return appStore.getState().computed.project.path;
  }
}
