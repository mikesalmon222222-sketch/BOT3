import mongoose from 'mongoose';

const credentialSchema = new mongoose.Schema({
  portal: {
    type: String,
    enum: ['SEPTA'],
    required: true,
    unique: true
  },
  usernameEnc: {
    type: String,
    required: true
  },
  passwordEnc: {
    type: String,
    required: true
  },
  lastTestedAt: {
    type: Date
  },
  lastTestOk: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const Credential = mongoose.model('Credential', credentialSchema);

export default Credential;