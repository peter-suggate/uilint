// Simple component that imports hook and utils
import { useData } from "./hook";
import { formatDate } from "./utils";

export function DataDisplay() {
  const { data } = useData();
  return <div>{formatDate(data.date)}</div>;
}
