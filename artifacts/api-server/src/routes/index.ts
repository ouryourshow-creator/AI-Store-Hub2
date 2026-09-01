import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import adminRouter from "./admin";
import storageRouter from "./storage";
import promoCodesRouter from "./promoCodes";
import categoriesRouter from "./categories";
import ordersRouter from "./orders";
import cashbackRouter from "./cashback";
import reviewsRouter from "./reviews";
import settingsRouter from "./settings";
import crmRouter from "./crm";
import paypalRouter from "./paypal";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(adminRouter);
router.use(storageRouter);
router.use(promoCodesRouter);
router.use(categoriesRouter);
router.use(ordersRouter);
router.use(cashbackRouter);
router.use(reviewsRouter);
router.use(settingsRouter);
router.use(crmRouter);
router.use(paypalRouter);

export default router;
