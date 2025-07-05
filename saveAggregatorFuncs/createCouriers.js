import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

// Подключение к MongoDB
await mongoose.connect('mongodb://localhost:27017/crm');

// Схема курьера-агрегатора
const courierAggregatorSchema = new mongoose.Schema({
    fullName: String,
    firstName: String,
    lastName: String,
    password: String,
    email: String,
    phone: String,
    status: { type: String, default: "active" },
    carType: { type: String, default: "A" },
    income: { type: Number, default: 0 },
    birthDate: String,
    country: String,
    city: String,
    languages: [String],
    onTheLine: { type: Boolean, default: false },
    notificationPushToken: String,
    orders: [Object],
    order: Object,
    points: {
        lat: Number,
        lon: Number,
        timestamp: Date
    }
}, { timestamps: true });

const CourierAggregator = mongoose.model('CourierAggregator', courierAggregatorSchema);

async function createCouriers() {
    try {
        const password = "qweasdzxc";
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        const couriers = [
            {
                fullName: "Смирнов Алексей Викторович",
                firstName: "Алексей",
                lastName: "Смирнов",
                password: hash,
                email: "courier4@test.com", 
                phone: "+77774567890",
                status: "active",
                carType: "B",
                income: 0,
                birthDate: "1992-03-25",
                country: "Казахстан",
                city: "Алматы",
                languages: ["Русский"],
                onTheLine: true,
                point: {
                    lat: 43.16859,
                    lon: 76.89639,
                    timestamp: new Date()
                }
            },
            {
                fullName: "Козлов Дмитрий Андреевич",
                firstName: "Дмитрий",
                lastName: "Козлов",
                password: hash,
                email: "courier5@test.com",
                phone: "+77775678901",
                status: "active", 
                carType: "A",
                income: 0,
                birthDate: "1987-11-30",
                country: "Казахстан",
                city: "Алматы",
                languages: ["Русский", "Казахский"],
                onTheLine: true,
                point: {
                    lat: 43.16859,
                    lon: 76.89639,
                    timestamp: new Date()
                }
            },
            {
                fullName: "Морозов Игорь Сергеевич",
                firstName: "Игорь",
                lastName: "Морозов",
                password: hash,
                email: "courier6@test.com",
                phone: "+77776789012",
                status: "active",
                carType: "B",
                income: 0,
                birthDate: "1995-07-15",
                country: "Казахстан",
                city: "Алматы",
                languages: ["Русский"],
                onTheLine: true,
                point: {
                    lat: 43.16859,
                    lon: 76.89639,
                    timestamp: new Date()
                }
            }
        ];


        for (let courierData of couriers) {
            const courier = new CourierAggregator(courierData);
            await courier.save();
            console.log(`Курьер ${courierData.fullName} создан с ID: ${courier._id}`);
        }

        console.log('Все три курьера успешно созданы!');
        console.log('Координаты: 43.16859, 76.89639');
        console.log('Пароль для всех курьеров: qweasdzxc');

    } catch (error) {
        console.error('Ошибка при создании курьеров:', error);
    } finally {
        await mongoose.connection.close();
    }
}

createCouriers(); 