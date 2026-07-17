import { Nullish } from "../../shared/nullish";
import Logger from "@/utils/logger";

export default class PStorage {
  public static async get<TData>(key: string): Promise<Nullish<TData>> {
    const rawValue = localStorage.getItem(key);
    if (rawValue === null || rawValue.trim().length === 0) {
      return undefined;
    }

    try {
      return JSON.parse(rawValue) as TData;
    } catch (error) {
      Logger.error(`Failed to parse local storage key "${key}".`, error, { rawValue });
      throw error;
    }
  }

  public static async set<TData>(key: string, value: TData): Promise<void> {
    localStorage.setItem(key, JSON.stringify(value));
  }

  public static async delete(key: string): Promise<void> {
    localStorage.removeItem(key);
  }
}
