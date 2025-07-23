import { reGenerateS3AccessKey } from "./s3";
import * as adminsService from "./admins";
import * as customersService from "./customers";
import * as ordersService from "./orders";
import * as paymentsService from "./payments";
import * as categoriesService from "./categories";
import * as productsService from "./products";

export {
  productsService,
  categoriesService,
  paymentsService,
  adminsService,
  ordersService,
  customersService,
};
