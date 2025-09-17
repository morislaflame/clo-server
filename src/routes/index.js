const Router = require('express');

const userRouter = require('./userRouter');
const productRouter = require('./productRouter');
const sizeRouter = require('./sizeRouter');
const colorRouter = require('./colorRouter');
const clothingTypeRouter = require('./clothingTypeRouter');
const basketRouter = require('./basketRouter');
const orderRouter = require('./orderRouter');
const newsRouter = require('./newsRouter');
const tagRouter = require('./tagRouter');
const newsTypeRouter = require('./newsTypeRouter');

const router = new Router();

router.use('/user', userRouter);
router.use('/product', productRouter);
router.use('/size', sizeRouter);
router.use('/color', colorRouter);
router.use('/clothing-type', clothingTypeRouter);
router.use('/basket', basketRouter);
router.use('/order', orderRouter);
router.use('/news', newsRouter);
router.use('/tag', tagRouter);
router.use('/news-type', newsTypeRouter);

module.exports = router;