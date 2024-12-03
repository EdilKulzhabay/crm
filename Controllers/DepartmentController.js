import mongoose from "mongoose";
import Department from "../Models/Department.js";
import DepartmentHistory from "../Models/DepartmentHistory.js";
import Queue from "../Models/Queue.js";
import User from "../Models/User.js";
import bcrypt from "bcrypt";

export const addDepartment = async (req, res) => {
    try {
        const { fullName, userName, receiving } = req.body;

        const candidate = await Department.findOne({ userName });

        if (candidate) {
            return res.status(409).json({
                success: false,
                message: "Сотрудник цеха с таким именем уже существует",
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(req.body.password, salt);

        const doc = new Department({
            fullName,
            password: hash,
            userName,
            receiving,
            createdAt: new Date(new Date().getTime() + 5 * 60 * 60 * 1000)
        });

        await doc.save();

        res.json({
            success: true,
            message: "Сотрудник цеха успешно добавлен",
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const getDepartments = async (req, res) => {
    try {
        const departments = await Department.find()

        res.json({departments})
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const getDepartmentData = async (req, res) => {
    try {
        const { id } = req.body
        const department = await Department.findById(id)

        if (!department) {
            res.status(500).json({
                message: "Department not found",
            });
        }

        res.json({department})
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const updateDepartmentData = async (req, res) => {
    try {
        const { departmentId, field, value } = req.body;

        const department = await Department.findById(departmentId);
        if (!department) {
            return res
                .status(404)
                .json({ success: false, message: "Client not found" });
        }

        department[field] = value;
        await department.save();

        res.json({ success: true, message: "Данные успешно изменены" });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const deleteDepartment = async (req, res) => {
    try {
        const { id } = req.body
        const delRes = await Department.findByIdAndDelete(id);

        if (!delRes) {
            return res.status(400).json({
                success: false,
                message: "Не удалось удалить сотрудника",
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
}

export const departmentAction = async (req, res) => {
    try {
        const {id, franchisee, type, data, receivingFinish} = req.body

        const department = await Department.findById(id)

        const history = new DepartmentHistory({
            department: id,
            franchisee,
            type,
            data,
            createdAt: new Date(new Date().getTime() + 5 * 60 * 60 * 1000)
        })

        const time  = new Date(new Date().getTime() + 5 * 60 * 60 * 1000)
        console.log(time);
        

        await history.save()

        if (!receivingFinish) {
            if (type) {
                const queue = new Queue({
                    franchisee,
                    createdAt: new Date(new Date().getTime() + 5 * 60 * 60 * 1000)
                })
                await queue.save()
            } else {
                await Queue.findOneAndDelete({franchisee})
            }
        }
        
        const fran = await User.findById(franchisee)
        if (type) {
            fran.b121kol = fran.b121kol + data.b121kol
            fran.b191kol = fran.b191kol + data.b191kol
            fran.b197kol = fran.b197kol + data.b197kol
        } else {
            fran.b121kol = fran.b121kol - data.b121kol
            fran.b191kol = fran.b191kol - data.b191kol
            fran.b197kol = fran.b197kol - data.b197kol
        }

        await fran.save()

        res.json({
            success: true
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const departmentSkip = async (req, res) => {
    try {
        const firstDoc = await Queue.findOne() // Assuming sorting by _id brings the oldest to the top

        if (!firstDoc) {
            console.log("No document found in the queue.");
            return res.json({
                success: false
            });
        }

        await Queue.deleteOne({ _id: firstDoc._id });

        const newDoc = new Queue(firstDoc.toObject());
        await newDoc.save();

        res.json({
            success: true
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const getFirstQueue = async (req, res) => {
    try {
        const queue = await Queue.findOne({})

        let franchisee = null
        if (queue) {
            const id = queue.franchisee
            franchisee = await User.findById(id)
        }

        if (franchisee === null) {
            return res.json({
                success: false
            })
        }

        res.json({
            success: true,
            franchisee
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const getDepartmentHistory = async (req, res) => {
    try {
        const {startDate, endDate, franchisee, status} = req.body
        const eDate = new Date(`${endDate}T23:59:59`)

        const filter = {
            "createdAt": { $gte: startDate, $lte: eDate },
        };

        if (franchisee !== "all") {
            filter.franchisee = franchisee
        }

        if (status !== "all") {
            const type = status === "receiving" ? true : false
            filter.type = type
        }

        const history = await DepartmentHistory.find(filter)
        .populate("department")
        .populate("franchisee")

        res.json({history})
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const getDepartmentInfo = async (req, res) => {
    try {
        const {startDate, endDate} = req.body

        const franchisees = await User.find({role: "admin"}).select("_id fullName b121kol b191kol b197kol")

        res.json({franchisees})
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const getDepartmentInfoFranchisee = async (req, res) => {
    try {
        const {id, date} = req.body

        const today = new Date(date);
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const franchisee = await User.findById(id)

        const filter = {
            franchisee: new mongoose.Types.ObjectId(id),
            createdAt: { $gte: today, $lte: tomorrow },
        }

        const stats = await DepartmentHistory.aggregate([
            { $match: filter },
            { 
                $group: {
                    _id: null,
                    totalB121: { $sum: { $cond: ["$type", 0, "$data.b121kol"] } },
                    totalB191: { $sum: { $cond: ["$type", 0, "$data.b191kol"] } },
                    totalB197: { $sum: { $cond: ["$type", 0, "$data.b197kol"] } },
                    totalB1212: { $sum: { $cond: ["$type", "$data.b121kol", 0] } },
                    totalB1912: { $sum: { $cond: ["$type", "$data.b191kol", 0] } },
                    totalB1972: { $sum: { $cond: ["$type", "$data.b197kol", 0] } },
                }
            }
        ])

        const history = await DepartmentHistory.find(filter)
        .populate("department")
        .populate("franchisee")

        if (stats.length > 0){
            const {_id, ...bottles} = stats[0]
            const info = {...franchisee._doc, ...bottles}
            return res.json({info, history})
        }

        res.json({info: franchisee, history})
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const deleteDepartmentHistory = async (req, res) => {
    try {
        const {id} = req.body
        const departmentHistory = await DepartmentHistory.findById(id)

        const franchisee = departmentHistory.franchisee
        
        const fran = await User.findById(franchisee)
        if (departmentHistory.type) {
            fran.b121kol = fran.b121kol - departmentHistory.data.b121kol
            fran.b191kol = fran.b191kol - departmentHistory.data.b191kol
            fran.b197kol = fran.b197kol - departmentHistory.data.b197kol
        } else {
            fran.b121kol = fran.b121kol + departmentHistory.data.b121kol
            fran.b191kol = fran.b191kol + departmentHistory.data.b191kol
            fran.b197kol = fran.b197kol + departmentHistory.data.b197kol
        }

        await fran.save()

        await DepartmentHistory.deleteOne({_id: id})

        res.json({
            success: true,
            message: "Удаление прошло успешно"
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}