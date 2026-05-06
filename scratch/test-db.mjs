import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env') })

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
})

async function main() {
  console.log('Using URL:', process.env.DATABASE_URL?.split('@')[1])
  try {
    await prisma.$connect()
    console.log('Successfully connected to the database')
    const userCount = await prisma.user.count()
    console.log(`User count: ${userCount}`)
  } catch (error) {
    console.error('Failed to connect to the database:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
