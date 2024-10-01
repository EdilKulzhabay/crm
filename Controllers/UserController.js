import User from "../Models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Courier from "../Models/Courier.js";
import Department from "../Models/Department.js";

export const register = async (req, res) => {
    try {
        const { userName, fullName, phone, mail, role } = req.body;

        console.log(userName);
        

        const candidate = await User.findOne({ userName });

        if (candidate) {
            return res.status(409).json({
                message: "Пользователь с таким именем уже существует",
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(req.body.password, salt);

        const doc = new User({
            userName,
            fullName,
            password: hash,
            phone,
            mail,
            role: role || "admin",
        });

        const user = await doc.save();

        const token = jwt.sign(
            {
                _id: user._id,
            },
            process.env.SecretKey,
            {
                expiresIn: "30d",
            }
        );

        res.json({ token });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Не удалось зарегистрировать пользователя",
        });
    }
};

export const login = async (req, res) => {
    try {
        const { userName, password } = req.body;

        const candidate = await User.findOne({ userName });

        if (!candidate) {

            const courier = await Courier.findOne({phone: userName})

            if (!courier) {

                const department = await Department.findOne({ userName });

                if (!department) {
                    return res.status(404).json({
                        message: "Неверный логин или пароль",
                    });
                }

                if (department) {
                    console.log(department.password);
                    
                    const isValidPassC = await bcrypt.compare(password, department.password);
    
                    if (!isValidPassC) {
                        return res.status(404).json({
                            message: "Неверный логин или пароль",
                        });
                    }
    
                    if (department.status !== "active") {
                        return res.status(404).json({
                            message: "Ваш аккаунт заблокироан, свяжитесь с вашим франчайзи",
                        });
                    }
    
                    const token = jwt.sign({ _id: department._id }, process.env.SecretKey, {
                        expiresIn: "30d",
                    });
    
                    const role = "department";
    
                    return res.json({ token, role });
                }

                return res.status(404).json({
                    message: "Неверный логин или пароль",
                });
            } 
            
            if (courier) {
                const isValidPassC = await bcrypt.compare(password, courier.password);

                if (!isValidPassC) {
                    return res.status(404).json({
                        message: "Неверный логин или пароль",
                    });
                }

                if (courier.status !== "active") {
                    return res.status(404).json({
                        message: "Ваш аккаунт заблокироан, свяжитесь с вашим франчайзи",
                    });
                }

                const token = jwt.sign({ _id: courier._id }, process.env.SecretKey, {
                    expiresIn: "30d",
                });

                const role = "courier";

                return res.json({ token, role });
            }

            return res.status(404).json({
                message: "Неверный логин или пароль",
            });
        }

        const isValidPass = await bcrypt.compare(password, candidate.password);

        if (!isValidPass) {
            return res.status(404).json({
                message: "Неверный логин или пароль",
            });
        }

        if (candidate.status !== "active") {
            return res.status(404).json({
                message: "Ваш аккаунт заблокироан, свяжитесь с вашим франчайзи",
            });
        }

        const token = jwt.sign({ _id: candidate._id }, process.env.SecretKey, {
            expiresIn: "30d",
        });

        const role = candidate.role;

        res.json({ token, role });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Не удалось авторизоваться",
        });
    }
};

export const getMe = async (req, res) => {
    try {
        const id = req.userId;

        const user = await User.findById(id);

        if (!user) {
            const courier = await Courier.findById(id)

            if (!courier) {
                const department = await Department.findById(id)

                const {password, ...userData} = department._doc
                userData.role = "department"

                return res.json(userData)
            }

            const {password, ...userData} = courier._doc
            userData.role = "courier"

            return res.json(userData)
        }

        const { password, ...userData } = user._doc;

        res.json(userData);
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const getAllFranchisee = async (req, res) => {
    try {
        const franchisees = await User.find();

        if (!franchisees) {
            return res.status(409).json({
                message: "Не получилось получить список",
            });
        }

        res.json({ franchisees });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const getFranchiseeById = async (req, res) => {
    try {
        const { id } = req.body;

        const franchisee = await User.findById(id);

        if (!franchisee) {
            return res.status(409).json({
                message: "Не получилось найти франчайзи",
            });
        }

        res.json({ franchisee });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const updateFranchisee = async (req, res) => {
    try {
        const { _id, userName, fullName, mail, phone, status } = req.body;

        const updateRes = await User.findByIdAndUpdate(
            _id,
            { userName, fullName, mail, phone, status },
            { new: true }
        );

        if (!updateRes) {
            return res.status(400).json({
                message: "Что то пошло не так",
            });
        }
        res.json({
            franchisee: updateRes,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const deleteFranchisee = async (req, res) => {
    try {
        const { id } = req.body;
        const delRes = await User.findByIdAndDelete(id);

        if (!delRes) {
            return res.status(400).json({
                message: "Не удалось удалить пользователя",
            });
        }
        res.json({
            success: true,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const searchFrinchisee = async (req, res) => {
    try {
        const { str } = req.body;

        if (!str) {
            return res.status(400).json({
                message: "Строка поиска не может быть пустой",
            });
        }

        const regex = new RegExp(str, "i"); // "i" делает поиск без учета регистра
        const franchisees = await User.find({
            role: "admin",
            $or: [
                { userName: { $regex: regex } },
                { fullName: { $regex: regex } },
                { mail: { $regex: regex } },
            ],
        });

        res.json({ franchisees });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const changePassword = async (req, res) => {
    try {
        const id = req.userId;
        const { password, newPassword } = req.body;

        const candidate = await User.findById(id);

        if (!candidate) {

            const courier = await Courier.findById(id)

            if (!courier) {

                const department = await Department.findById(id)

                if (!department) {
                    return res.json({
                        success: false,
                        message: "Не удалось найти пользователя",
                    });
                }

                if (department) {
                    const isValidPass = await bcrypt.compare(password, department.password);

                    if (!isValidPass) {
                        return res.json({
                            success: false,
                            message: "Пароль введен не правильно",
                        });
                    }

                    const salt = await bcrypt.genSalt(10);
                    const hash = await bcrypt.hash(newPassword, salt);

                    department.password = hash;

                    await department.save();

                    return res.json({
                        success: true,
                    });
                }

                return res.json({
                    success: false,
                    message: "Не удалось найти пользователя",
                });
            }

            if (courier) {
                const isValidPass = await bcrypt.compare(password, courier.password);

                if (!isValidPass) {
                    return res.json({
                        success: false,
                        message: "Пароль введен не правильно",
                    });
                }

                const salt = await bcrypt.genSalt(10);
                const hash = await bcrypt.hash(newPassword, salt);

                courier.password = hash;

                await courier.save();

                return res.json({
                    success: true,
                });
            }

            return res.json({
                success: false,
                message: "Не удалось найти пользователя",
            });
        }

        const isValidPass = await bcrypt.compare(password, candidate.password);

        if (!isValidPass) {
            return res.json({
                success: false,
                message: "Пароль введен не правильно",
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);

        candidate.password = hash;

        await candidate.save();

        res.json({
            success: true,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const updateNotificationStatus = async (req, res) => {
    try {
        const id = req.userId;
        const { status } = req.body;
        const candidate = await User.findById(id);

        candidate.notificationStatus = status;

        await candidate.save();

        res.json({
            success: true,
            message: "Статус уведомления изменен",
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const updateNotificationTypes = async (req, res) => {
    try {
        const id = req.userId;
        const { type } = req.body;

        const candidate = await User.findById(id);

        const index = candidate.notificationTypes.indexOf(type);
        let criterion = false;

        if (index !== -1) {
            candidate.notificationTypes.splice(index, 1);
        } else {
            candidate.notificationTypes.push(type);
            criterion = true;
        }

        await candidate.save();

        res.json({
            succes: true,
            message: criterion ? "Критерий добавлен" : "Критерий убран",
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};
