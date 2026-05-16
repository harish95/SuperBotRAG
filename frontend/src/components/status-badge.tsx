import { Badge } from "@/components/ui/badge";
import type { UploadStatus } from "@/types";

export function StatusBadge({ status }: { status: UploadStatus | string }) {
  if (status === "processed") {
    return <Badge variant="success">Processed</Badge>;
  }

  if (status === "failed") {
    return <Badge variant="danger">Failed</Badge>;
  }

  return <Badge variant="warning">Processing</Badge>;
}
