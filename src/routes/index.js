const Router = require('express');

const userRouter = require('./userRouter');
const productRouter = require('./productRouter');
const sizeRouter = require('./sizeRouter');
const colorRouter = require('./colorRouter');
const clothingTypeRouter = require('./clothingTypeRouter');

const router = new Router();

router.use('/user', userRouter);
router.use('/product', productRouter);
router.use('/size', sizeRouter);
router.use('/color', colorRouter);
router.use('/clothing-type', clothingTypeRouter);

module.exports = router;