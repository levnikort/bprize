import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { MongoClient } from "mongodb";
import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.write("OK");
})

const client = new MongoClient(process.env.DB_URL);
await client.connect();
const db = client.db("lava");
const Users = db.collection("users");
const Codes = db.collection("codes");

const addCode = async (db, telegramId, code) => {
  let user = await Users.findOne({ telegram_id: telegramId });

  if (!user) {
    const result = await Users.insertOne({ telegram_id: telegramId });
    user = { _id: result.insertedId };
  }

  const codeCount = await Codes.countDocuments({ user_id: user._id });

  if (codeCount >= 5) {
    throw new Error("Пользователь уже ввёл 5 кодов.");
  }
  
  await Codes.insertOne({ user_id: user._id, code });
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
    total = await Users.countDocuments();
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
    await addCode(db, ctx.from.id, ctx.message.text);
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