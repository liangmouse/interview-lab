import dayjs from "dayjs";
import "dayjs/locale/zh-cn";

export function formatDateTime(value?: string | null): string {
  if (!value) {
    return "";
  }

  const date = dayjs(value);
  if (!date.isValid()) {
    return value;
  }

  return date.locale("zh-cn").format("YYYY/MM/DD HH:mm");
}
