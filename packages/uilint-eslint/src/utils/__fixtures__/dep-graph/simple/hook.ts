// Hook that imports api
import { fetchData } from "./api";

export function useData() {
  const data = fetchData();
  return { data };
}
