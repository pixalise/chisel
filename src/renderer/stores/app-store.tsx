import { Nullish } from "../../shared/nullish";
import { create } from "zustand";
import { isNil } from "lodash";
import { Project } from "../../shared/schemas";

export interface AppStore {
  _project?: Nullish<Project>;
  setProject: (project: Nullish<Project>) => void;
  computed: {
    get project(): Project;
    get isProjectSelected(): boolean;
  };
}

const useAppStore = create<AppStore>((set, get) => ({
  _project: undefined,
  setProject: (project) => set({ _project: project }),
  computed: {
    get project(): Project {
      const { _project } = get();
      if (isNil(_project)) {
        throw new Error("Illegal access to project, _project is not set.");
      }
      return _project;
    },
    get isProjectSelected(): boolean {
      const { _project } = get();
      return !isNil(_project);
    }
  }
}));
export default useAppStore;
