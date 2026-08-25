//src/modules/auth/providers/bcrypt.provider.ts

import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

export const bcryptProvider = {
  hash:    (password: string)              => bcrypt.hash(password, SALT_ROUNDS),
  compare: (password: string, hash: string) => bcrypt.compare(password, hash),
}