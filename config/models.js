const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = mongoose.Schema({
  name: {
    type: String,
    required: true
  }, email: {
    type: String,
    required: true,
    unique: true
  }, password: {
    type: String,
    required: true
  }, pic: {
    type: String,
    default: "https://www.pngfind.com/pngs/m/676-6764065_default-profile-picture-transparent-hd-png-download.png"
  }, verified: {
    type: Boolean,
    required: true,
    default: false
  },
  subscriptions: {
    type: {
      web: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
      },
      mobile: {
        type: mongoose.Schema.Types.Mixed, 
        default: {}
      }
    },
    required: true, 
    default: { web: {}, mobile: {} }
  }
}, { timestamps: true })

const User = mongoose.model("User", userSchema);

const noteModel = mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: false,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    pinned: {
      type: Boolean,
      default: false
    },
    archived: {
      type: Boolean,
      default: false
    },
    color: {
      type: String,
      default: "#202124",
    },
  },
  {
    timestamps: true,
  }
);

const Note = mongoose.model("Note", noteModel)


const noteHistoryModel = mongoose.Schema(
  {
    note: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Note"
    },
    h1: {
      type: String,
    },
    h2: {
      type: String,
    },
    h3: {
      type: String,
    }
  }, {
  timestamps: true,
}
);

const NoteHistory = mongoose.model("NoteHistory", noteHistoryModel);


const noteAccessModel = mongoose.Schema(
  {
    note: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Note"
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    isActive: {
      type: Boolean,
      require: true
    }
  }, {
  timestamps: true,
}
)

const NoteAccess = mongoose.model("NoteAccess", noteAccessModel);


const expensesModel = mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  cost: {
    type: Number,
    require: true
  },
  category: {
    type: String,
    require: true
  },
  description: {
    type: String,
    require: true
  },
  date: {
    type: Date,
    require: true
  },
  isActive: {
    type: Boolean,
    require: true,
    default: true
  },

}, {
  timestamps: true,
})


const Expenses = mongoose.model("Expenses", expensesModel);


const remainderModel = mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  date: {
    type: Date,
    required:true,
  }, description: {
    type:String,
  }, expired: {
    type: Boolean,
    required: true,
    default: false
  }, latestNotification: {
    type: Object
  }
}, { timestamps: true },)

const Remainder = mongoose.model("Remainder", remainderModel)


module.exports = { User, Note, NoteHistory, NoteAccess, Expenses, Remainder }