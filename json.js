
db.courieraggregators.updateOne(
    { _id: ObjectId('68413276b70d315d3b2b732f') },
    {
      $pull: {
        orders: { orderId: '68442ad091a126d864d3cafb' }
      }
    }
  )