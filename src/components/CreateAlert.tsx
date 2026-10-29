import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

/** Legacy entry point; all writes now use the canonical Alert Center workflow. */
export function CreateAlert() {
  return <Button asChild><Link to="/alerts?report=1">Report a safety observation</Link></Button>;
}
