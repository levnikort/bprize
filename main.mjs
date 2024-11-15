import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import Database from "better-sqlite3";
import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.write("OK");
})

const db = new Database("data.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const addCode = (db, telegramId, code) => {
  // Убедимся, что пользователь существует
  let user = db
    .prepare("SELECT id FROM users WHERE telegram_id = ?")
    .get(telegramId);

  if (!user) {
    // Если пользователя нет, создаём его
    const insertUser = db.prepare("INSERT INTO users (telegram_id) VALUES (?)");
    const info = insertUser.run(telegramId);
    user = { id: info.lastInsertRowid }; // Получаем ID нового пользователя
  }

  // Проверяем, сколько кодов уже добавлено пользователем
  const codeCount = db
    .prepare("SELECT COUNT(*) AS codeCount FROM codes WHERE user_id = ?")
    .get(user.id).codeCount;

  if (codeCount >= 5) {
    throw new Error("Пользователь уже ввёл 5 кодов.");
  }

  // Добавляем новый код
  const insertCode = db.prepare(
    "INSERT INTO codes (user_id, code) VALUES (?, ?)"
  );
  insertCode.run(user.id, code);
};

const bot = new Telegraf(process.env.BOT_TOKEN);
bot.start((ctx) =>
  ctx.reply(`
Здравствуйте. Вас приветствует бот LAVA — здесь Вы сможете зарегистрироваться в розыгрыше 1 000 призов! 💖

Среди них iPhone 16 Pro, AirPods Pro, годовой абонемент на все ивенты LAVA, деньги, десятки пицц и сотни других призов!

Для регистрации отправьте, пожалуйста, номер Вашего билета. Например: 12312312
`)
);

bot.command('users', async (ctx) => {
  let total = 0;

  try {
    total = db
      .prepare("SELECT COUNT(*) AS total FROM users")
      .get().total;
  } catch (err) {
    console.error(err);
    return await ctx.reply("Что-то пошло не так :(");
  }

  await ctx.reply(`Пользователи: ${total}`);
})

bot.on(message("text"), async (ctx) => {
  const codeInt = parseInt(ctx.message.text);

  if (isNaN(codeInt)) {
    return await ctx.reply(`
Упс, кажется, это не номер билета :(

Попробуйте еще раз!
  `);
  }

  if (codeInt.toString().length !== 8) {
    return await ctx.reply(`
Упс, кажется, это не номер билета :(

В номере билета должно быть 8 символов.

Попробуйте еще раз!
  `);
  }

  try {
    addCode(db, ctx.from.id, ctx.message.text);
  } catch (err) {
    if (err.message === "Пользователь уже ввёл 5 кодов.") {
      return await ctx.reply("Вы ввели максимальное количество кодов.\n\nОжидайте результатов!");
    }

    console.error(err);
    return await ctx.reply("Что-то пошло не так, мы не смогли добавить вашь код :(");
  }

  await ctx.reply(`
Поздравляем! 

Вы успешно зарегистрировались в розыгрыше призов. Ожидайте подведения итогов 22 ноября в 22:00!
  `);
});

app.listen(process.env.PORT || 3000, async () => {
  console.log("server run, port " + (process.env.PORT || 3000));
  await bot.launch(async () => {
    setInterval(() => {
      fetch("https://bprize.onrender.com").then(() => {
        console.log("ping");
      });
    }, 2 * 60 * 1000);
  });
});