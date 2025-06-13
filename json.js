db.courieraggregators.updateMany(
  { email: { $in: ['zhenisulyerbol76@gmail.com', 'nur_gan_at@mail.ru'] } },
  { $set: { onTheLine: false } }
)

db.courieraggregators.updateMany(
  { email: { $in: ['zhenisulyerbol76@gmail.com'] } },
  { $set: { onTheLine: true } }
)
