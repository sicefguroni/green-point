declare module "swagger-ui-react" {
  import type { ComponentType } from "react";

  export interface SwaggerUIProps {
    readonly url?: string;
    readonly spec?: object;
    readonly docExpansion?: string;
    readonly defaultModelsExpandDepth?: number;
    readonly persistAuthorization?: boolean;
  }

  const SwaggerUI: ComponentType<SwaggerUIProps>;
  export default SwaggerUI;
}
