import { onRequest as __api_news___path___js_onRequest } from "/Users/jijoperinchery/Projects/my-dashboard/functions/api/news/[[path]].js"
import { onRequest as __api_nominatim___path___js_onRequest } from "/Users/jijoperinchery/Projects/my-dashboard/functions/api/nominatim/[[path]].js"

export const routes = [
    {
      routePath: "/api/news/:path*",
      mountPath: "/api/news",
      method: "",
      middlewares: [],
      modules: [__api_news___path___js_onRequest],
    },
  {
      routePath: "/api/nominatim/:path*",
      mountPath: "/api/nominatim",
      method: "",
      middlewares: [],
      modules: [__api_nominatim___path___js_onRequest],
    },
  ]