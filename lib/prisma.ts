const users: any[] = [];

const prisma = {
  user: {
    async findUnique({ where: { email } }: any) {
      return users.find(u => u.email === email) || null;
    },
    async create({ data }: any) {
      const user = { id: (users.length + 1).toString(), role: 'MEMBER', ...data };
      users.push(user);
      return user;
    },
  },
  cookAssignment: {
    async findUnique() { return null; },
    async create({ data }: any) { return { ...data, id: (Math.random()*1e6).toString() }; },
  },
  rSVP: {
    async upsert({ create }: any) { return create; },
  },
  shoppingItem: {
    async create({ data }: any) { return { ...data, id: (Math.random()*1e6).toString() }; },
  },
  galleryItem: {
    async findUnique() { return null; },
    async delete({ where: { id } }: any) { return { id }; },
    async create({ data }: any) { return { ...data, id: (Math.random()*1e6).toString() }; },
  },
  $transaction: async (fn: any) => fn(prisma),
};

export default prisma;
export { users };
