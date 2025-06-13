db.courieraggregators.updateMany(
  { email: { $in: ['Tibetwater@inbox.ru', 'vasili0008@gmail.com'] } },
  { $set: { onTheLine: true } }
)

db.courieraggregators.updateMany(
  { email: { $in: ['Tibetwater@inbox.ru'] } },
  { $set: { onTheLine: true } }
)

db.courieraggregators.updateOne(
  { email: 'vasili0008@gmail.com' },
  {
    $pull: {
      orders: { orderId: '684bded1e9e36aa74add7ae8' }
    }
  }
)

