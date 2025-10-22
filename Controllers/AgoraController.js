// import { RtcTokenBuilder, RtcRole } from 'agora-access-token';
// import OrderModel from '../Models/OrderModel.js';
// import { sendPushNotification } from '../pushNotification.js';
// import { sendClientPushNotification } from '../pushNotificationClient.js';

// // Генерация токена для звонка
// export const generateAgoraToken = async (req, res) => {
//     try {
//         const { channelName, uid, role = 'publisher' } = req.body;

//         if (!channelName || !uid) {
//             return res.status(400).json({ 
//                 success: false, 
//                 message: 'Требуются channelName и uid' 
//             });
//         }

//         const appID = process.env.AGORA_APP_ID;
//         const appCertificate = process.env.AGORA_APP_CERTIFICATE;
        
//         if (!appID || !appCertificate) {
//             return res.status(500).json({ 
//                 success: false, 
//                 message: 'Agora credentials не настроены' 
//             });
//         }
        
//         // Токен действует 24 часа
//         const expirationTimeInSeconds = 86400;
//         const currentTimestamp = Math.floor(Date.now() / 1000);
//         const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

//         // Определяем роль (publisher = может говорить и слушать)
//         const tokenRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

//         // Генерируем токен
//         const token = RtcTokenBuilder.buildTokenWithUid(
//             appID,
//             appCertificate,
//             channelName,
//             uid,
//             tokenRole,
//             privilegeExpiredTs
//         );

//         return res.json({
//             success: true,
//             token,
//             appID,
//             channelName,
//             uid,
//             expiresAt: privilegeExpiredTs
//         });

//     } catch (error) {
//         console.error('Ошибка генерации Agora токена:', error);
//         return res.status(500).json({ 
//             success: false, 
//             message: 'Ошибка сервера при генерации токена',
//             error: error.message
//         });
//     }
// };

// // Инициация звонка от клиента к курьеру или наоборот
// export const initiateCall = async (req, res) => {
//     try {
//         const { orderId, callerId, callerType } = req.body; // callerType: 'client' или 'courier'

//         if (!orderId || !callerId || !callerType) {
//             return res.status(400).json({ 
//                 success: false, 
//                 message: 'Требуются orderId, callerId и callerType' 
//             });
//         }

//         // Находим заказ и получаем информацию о курьере/клиенте
//         const order = await OrderModel.findById(orderId)
//             .populate('courierId', 'firstName phone pushToken')
//             .populate('clientId', 'name phone pushToken');

//         if (!order) {
//             return res.status(404).json({ 
//                 success: false, 
//                 message: 'Заказ не найден' 
//             });
//         }

//         // Генерируем уникальное имя канала
//         const channelName = `order_${orderId}_${Date.now()}`;

//         // Определяем кому отправить уведомление
//         const recipient = callerType === 'client' ? order.courierId : order.clientId;
//         const caller = callerType === 'client' ? order.clientId : order.courierId;
        
//         if (!recipient || !recipient.pushToken) {
//             return res.status(400).json({ 
//                 success: false, 
//                 message: 'Получатель не найден или не имеет pushToken' 
//             });
//         }

//         // Отправляем push-уведомление о входящем звонке
//         const callerName = callerType === 'client' 
//             ? (order.clientId?.name || 'Клиент')
//             : (order.courierId?.firstName || 'Курьер');

//         const notificationData = {
//             type: 'incoming_call',
//             channelName,
//             orderId: orderId.toString(),
//             callerId: callerId.toString(),
//             callerType,
//             callerName,
//             orderNumber: order.orderNumber || '',
//         };

//         // Отправляем уведомление в зависимости от типа получателя
//         if (callerType === 'client') {
//             // Клиент звонит курьеру
//             await sendPushNotification(
//                 recipient.pushToken,
//                 'Входящий звонок',
//                 `${callerName} звонит вам по заказу #${order.orderNumber}`,
//                 notificationData
//             );
//         } else {
//             // Курьер звонит клиенту
//             await sendClientPushNotification(
//                 recipient.pushToken,
//                 'Входящий звонок',
//                 `${callerName} звонит вам по заказу #${order.orderNumber}`,
//                 notificationData
//             );
//         }

//         console.log(`Звонок инициирован: ${callerType} -> ${callerType === 'client' ? 'courier' : 'client'}, канал: ${channelName}`);

//         return res.json({
//             success: true,
//             channelName,
//             recipientId: recipient._id.toString(),
//             recipientName: callerType === 'client' 
//                 ? recipient.firstName 
//                 : recipient.name,
//             recipientPhone: recipient.phone
//         });

//     } catch (error) {
//         console.error('Ошибка инициации звонка:', error);
//         return res.status(500).json({ 
//             success: false, 
//             message: 'Ошибка сервера при инициации звонка',
//             error: error.message
//         });
//     }
// };

// // Сохранение истории звонка (опционально)
// export const saveCallHistory = async (req, res) => {
//     try {
//         const { orderId, channelName, duration, startedAt, endedAt, initiatedBy } = req.body;

//         // Здесь можно создать модель CallHistory и сохранить данные
//         // Пока просто логируем
//         console.log('История звонка:', {
//             orderId,
//             channelName,
//             duration,
//             startedAt,
//             endedAt,
//             initiatedBy
//         });

//         return res.json({
//             success: true,
//             message: 'История звонка сохранена'
//         });

//     } catch (error) {
//         console.error('Ошибка сохранения истории звонка:', error);
//         return res.status(500).json({ 
//             success: false, 
//             message: 'Ошибка сервера при сохранении истории',
//             error: error.message
//         });
//     }
// };

