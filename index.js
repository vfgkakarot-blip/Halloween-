// index.js
const { Client, GatewayIntentBits, ActivityType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
const { Riffy } = require('riffy');
const config = require('./config.js');
const express = require('express');
require('dotenv').config();

// Function to start Express server
function startExpressServer() {
  if (config.express.enabled) {
    const app = express();

    app.get('/', (req, res) => {
      res.json({
        status: 'online',
        bot: client.user ? client.user.tag : 'Starting...',
        servers: client.guilds.cache ? client.guilds.cache.size : 0,
        uptime: process.uptime(),
        lavalink: isLavalinkConnected ? 'connected' : 'disconnected'
      });
    });

    app.get('/stats', (req, res) => {
      res.json({
        guilds: client.guilds.cache ? client.guilds.cache.size : 0,
        users: client.guilds.cache ? client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0) : 0,
        players: riffy.players ? riffy.players.size : 0,
        uptime: process.uptime(),
        memory: process.memoryUsage().heapUsed / 1024 / 1024,
        ping: client.ws ? client.ws.ping : 0,
        lavalink: isLavalinkConnected
      });
    });

    app.listen(config.express.port, '0.0.0.0', () => {
      console.log(`🌐 Express server running on port ${config.express.port}`);
    });
  }
}

// Start Express server before bot
startExpressServer();

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildVoiceStates,
  GatewayIntentBits.GuildMessages
];

if (config.enablePrefix) {
  intents.push(GatewayIntentBits.MessageContent);
}

const client = new Client({ intents });

let isLavalinkConnected = false;

const riffy = new Riffy(client, config.lavalink.nodes, {
  send: (payload) => {
    const guild = client.guilds.cache.get(payload.d.guild_id);
    if (guild) guild.shard.send(payload);
  },
  defaultSearchPlatform: "ytmsearch",
  restVersion: "v4"
});

// Fix Riffy Node initialization error by overriding the broken defineProperty call
// This is a workaround for the riffy package bug mentioned in the error
const { Node } = require('riffy/build/structures/Node');
const originalDefineProperty = Object.defineProperty;
Object.defineProperty = function(obj, prop, descriptor) {
    if (obj instanceof Node && (prop === 'host' || prop === 'port' || prop === 'password' || prop === 'secure' || prop === 'identifier')) {
        return originalDefineProperty(obj, prop, {
            value: descriptor.value,
            writable: true,
            enumerable: true,
            configurable: true
        });
    }
    try {
        return originalDefineProperty(obj, prop, descriptor);
    } catch (e) {
        // If it fails with the specific error, try a fallback
        if (e instanceof TypeError && e.message.includes('Invalid property descriptor')) {
            return originalDefineProperty(obj, prop, {
                value: descriptor.value,
                writable: true,
                enumerable: true,
                configurable: true
            });
        }
        throw e;
    }
};

const queue247 = new Set();

client.on('ready', async () => {
  console.log(`${config.emojis.success} Logged in as ${client.user.tag}`);

  try {
    riffy.init(client.user.id);
  } catch (error) {
    console.error(`${config.emojis.error} Failed to initialize Riffy:`, error);
  }

  const activityTypes = {
    'PLAYING': ActivityType.Playing,
    'LISTENING': ActivityType.Listening,
    'WATCHING': ActivityType.Watching,
    'STREAMING': ActivityType.Streaming,
    'COMPETING': ActivityType.Competing
  };

  const activityType = activityTypes[config.activity.type] || ActivityType.Listening;
  client.user.setActivity(config.activity.name, { type: activityType });
  console.log(`${config.emojis.success} Activity set: ${config.activity.type} ${config.activity.name}`);

  const commands = [
    { name: 'play', description: 'Play a song', options: [{ name: 'query', description: 'Song name or URL', type: 3, required: true }] },
    { name: 'pause', description: 'Pause the current song' },
    { name: 'resume', description: 'Resume the paused song' },
    { name: 'skip', description: 'Skip the current song' },
    { name: 'stop', description: 'Stop the player and clear queue' },
    { name: 'volume', description: 'Set volume', options: [{ name: 'level', description: 'Volume level (1-100)', type: 4, required: true, min_value: 1, max_value: 100 }] },
    { name: 'queue', description: 'Show the current queue' },
    { name: 'nowplaying', description: 'Show currently playing song' },
    { name: 'shuffle', description: 'Shuffle the queue' },
    { name: 'loop', description: 'Toggle loop mode', options: [{ name: 'mode', description: 'Loop mode', type: 3, required: true, choices: [{ name: 'Off', value: 'none' }, { name: 'Track', value: 'track' }, { name: 'Queue', value: 'queue' }] }] },
    { name: 'remove', description: 'Remove a song from queue', options: [{ name: 'position', description: 'Position in queue', type: 4, required: true, min_value: 1 }] },
    { name: 'move', description: 'Move a song in queue', options: [{ name: 'from', description: 'From position', type: 4, required: true, min_value: 1 }, { name: 'to', description: 'To position', type: 4, required: true, min_value: 1 }] },
    { name: 'clearqueue', description: 'Clear the queue' },
    { name: '247', description: 'Toggle 24/7 mode' },
    { name: 'stats', description: 'Show bot statistics' },
    { name: 'ping', description: 'Show bot latency' },
    { name: 'invite', description: 'Get bot invite link' },
    { name: 'support', description: 'Get support server link' },
    { name: 'help', description: 'Show all commands' }
  ];

  await client.application.commands.set(commands);
  console.log(`${config.emojis.success} Slash commands registered globally`);
});

client.on('raw', (d) => riffy.updateVoiceState(d));

riffy.on('nodeConnect', (node) => {
  console.log(`${config.emojis.success} Node ${node.name} connected`);
  isLavalinkConnected = true;
});

riffy.on('nodeError', (node, error) => {
  console.error(`${config.emojis.error} Node ${node.name} error:`, error);
  isLavalinkConnected = false;
});

riffy.on('nodeDisconnect', (node) => {
  console.log(`${config.emojis.error} Node ${node.name} disconnected`);
  isLavalinkConnected = false;
});

const nowPlayingMessages = new Map();

function formatTime(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function createNowPlayingContainer(player, track, disabled = false) {
  const info = track.info ?? {};
  let thumbnail = info.artworkUrl || info.thumbnail || null;

  // Fix YouTube thumbnail
  if (!thumbnail && info.uri && info.uri.includes('youtube.com')) {
    const videoId = info.uri.split('v=')[1]?.split('&')[0];
    if (videoId) {
      thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }
  }

  // Fix youtu.be thumbnail
  if (!thumbnail && info.uri && info.uri.includes('youtu.be')) {
    const videoId = info.uri.split('youtu.be/')[1]?.split('?')[0];
    if (videoId) {
      thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }
  }

  // Default thumbnail
  if (!thumbnail) {
    thumbnail = 'https://i.imgur.com/QYJfXQv.png';
  }

  const isPaused = player.paused;

  const container = new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent(`## ${config.emojis.music} Now Playing\n**[${info.title || 'Unknown Title'}](${info.uri || 'https://youtube.com'})**`)
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder()
            .setURL(thumbnail)
            .setDescription(info.title || 'Song Thumbnail')
        )
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`**Duration:** ${formatTime(info.length || 0)} • **Requested By:** <@${track.info.requester}>`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
        .setDivider(true)
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(isPaused ? 'resume' : 'pause')
          .setEmoji(isPaused ? config.emojis.play : config.emojis.pause)
          .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Primary)
          .setDisabled(disabled),

        new ButtonBuilder()
          .setCustomId('skip')
          .setEmoji(config.emojis.skip)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(disabled),

        new ButtonBuilder()
          .setCustomId('stop')
          .setEmoji(config.emojis.stop)
          .setStyle(ButtonStyle.Danger)
          .setDisabled(disabled),

        new ButtonBuilder()
          .setCustomId('shuffle')
          .setEmoji(config.emojis.shuffle)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled),

        new ButtonBuilder()
          .setCustomId('queue')
          .setEmoji(config.emojis.queue)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled)
      )
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('loop')
          .setEmoji(config.emojis.loop)
          .setStyle(
            player.loop && player.loop !== 'none'
              ? ButtonStyle.Success
              : ButtonStyle.Secondary
          )
          .setDisabled(disabled)
      )
    );

  return container;
}
}

function createSimpleContainer(title, description, emoji = config.emojis.info) {
  return new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent(`## ${emoji} ${title}\n${description}`)
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder()
            .setURL(client.user.displayAvatarURL({ size: 1024 }))
            .setDescription(title)
        )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );
}

function createSimpleContainerNoButtons(title, description, emoji = config.emojis.info) {
  return new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent(`## ${emoji} ${title}\n${description}`)
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder()
            .setURL(client.user.displayAvatarURL({ size: 1024 }))
            .setDescription(title)
        )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );
}

function createQueueContainer(player, guild, user) {
  const queue = player.queue ?? [];
  const current = player.current;
  let description = '';

  if (current?.info) {
    description += `**Now Playing:**\n**[${current.info.title}](${current.info.uri})**\n${current.info.author || 'GblVijju'} • ${formatTime(current.info.length)} • <@${current.info.requester}>\n\n`;
  }

  if (queue.length > 0) {
    description += `**Up Next:**\n`;
    const upcoming = queue.slice(0, 10);
    upcoming.forEach((t, i) => {
      const inf = t.info || {};
      description += `\`${i + 1}.\` **[${inf.title}](${inf.uri})**\n${inf.author || 'GblVijju'} • ${formatTime(inf.length || 0)} • <@${t.info.requester}>\n`;
    });
    if (queue.length > 10) {
      description += `\n*...and ${queue.length - 10} more track(s)*`;
    }
  } else if (!current) {
    description = 'The queue is currently empty.';
  }

  description += `\n\n**Loop:** ${(player.loop === 'none' || !player.loop) ? 'off' : player.loop} | **Total:** ${player.queue.length + 1} tracks`;

  let thumbnail = client.user.displayAvatarURL({ size: 1024 });

  return new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent(`## ${config.emojis.queue} Queue\n${description}`)
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder()
            .setURL(thumbnail)
            .setDescription('Queue')
        )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );
}

function createStatsContainer() {
  const uptime = formatTime(client.uptime);
  const players = riffy.players.size;
  const totalUsers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
  const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

  const description = `**Servers:** ${client.guilds.cache.size}\n**Users:** ${totalUsers}\n**Players:** ${players}\n**Uptime:** ${uptime}\n**Ping:** ${client.ws.ping}ms\n**Memory:** ${memory} MB`;

  return new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent(`## ${config.emojis.info} Bot Statistics\n${description}`)
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder()
            .setURL(client.user.displayAvatarURL({ size: 1024 }))
            .setDescription('Bot Avatar')
        )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );
}

function createHelpContainer() {
  const lavalinkStatus = isLavalinkConnected ? '🟢 Connected' : '🔴 Not Connected';

  const description = `A powerful music bot with high quality audio\n\n**Total Commands:** 17\n**Prefix:** \`${config.prefix}\`\n**Lavalink:** ${lavalinkStatus}\nMade by **GblVijju**\n\n**${config.emojis.music} Music Commands**\n**play** (p) - Play a song\n**pause** (pa) - Pause current song\n**resume** (r, res) - Resume playback\n**skip** (s, next) - Skip current song\n**stop** (st, leave) - Stop player\n**nowplaying** (np) - Show current song\n**queue** (q) - Show queue\n**loop** (l, repeat) - Loop mode\n**shuffle** (sh, mix) - Shuffle queue\n**volume** (v, vol) - Set volume\n**clearqueue** (cq, clear) - Clear queue\n**remove** (rm, delete) - Remove from queue\n**move** (mv) - Move in queue\n**247** (24/7, stay) - Toggle 24/7\n\n**${config.emojis.info} Utility Commands**\n**stats** (status, info) - Bot stats\n**ping** (latency) - Bot ping\n**invite** (inv) - Invite link\n**support** (server) - Support server\n**help** (h, cmd) - This message`;

  return new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent(`## ${client.user.username} Help\n${description}`)
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder()
            .setURL(client.user.displayAvatarURL({ size: 1024 }))
            .setDescription('Bot Avatar')
        )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addActionRowComponents(
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel('Invite Me')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://discord.com/oauth2/authorize?client_id=1467199219654856836&permissions=8&integration_type=0&scope=bot+applications.commands`),
          new ButtonBuilder()
            .setLabel('Support')
            .setStyle(ButtonStyle.Link)
            .setURL(config.supportServer)
        )
    );
}

riffy.on('trackStart', async (player, track) => {
  const channel = client.channels.cache.get(player.textChannel);
  if (!channel) return;

  const container = createNowPlayingContainer(player, track);

  try {
    const msg = await channel.send({ components: [container], flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
    nowPlayingMessages.set(player.guildId, msg);
  } catch (err) {
    console.error('Failed to send Now Playing message:', err);
  }
});

riffy.on('queueEnd', async (player) => {
  const channel = client.channels.cache.get(player.textChannel);

  const msg = nowPlayingMessages.get(player.guildId);
  if (msg && player.current) {
    try {
      const disabledContainer = createNowPlayingContainer(player, player.current, true);
      await msg.edit({ components: [disabledContainer], flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
    } catch (error) {
      console.error('Failed to disable buttons:', error);
    }
    nowPlayingMessages.delete(player.guildId);
  }

  if (queue247.has(player.guildId)) {
    if (channel) {
      const container = createSimpleContainerNoButtons('24/7 Mode', 'Queue ended but staying in 24/7 mode', config.emojis.info);
      await channel.send({ components: [container], flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
    }
    return;
  }

  if (channel) {
    const container = createSimpleContainerNoButtons('Queue Ended', 'Queue ended, leaving voice channel', config.emojis.success);
    await channel.send({ components: [container], flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
  }

  player.destroy();
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    const player = riffy.players.get(interaction.guildId);

    if (!player) {
      return interaction.reply({ content: `${config.emojis.error} No player found`, ephemeral: true });
    }

    const member = interaction.member;
    if (!member.voice.channel) {
      return interaction.reply({ content: `${config.emojis.error} You need to be in a voice channel`, ephemeral: true });
    }

    if (member.voice.channel.id !== player.voiceChannel) {
      return interaction.reply({ content: `${config.emojis.error} You need to be in the same voice channel`, ephemeral: true });
    }

    switch (interaction.customId) {
      case 'pause':
      case 'resume': {
        const message = nowPlayingMessages.get(player.guildId);
        const shouldPause = interaction.customId === 'pause';
        await player.pause(shouldPause);

        if (message && player.current) {
          const updatedContainer = createNowPlayingContainer(player, player.current);
          await message.edit({ components: [updatedContainer], flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 }).catch(() => {});
        }

        await interaction.reply({ 
          content: shouldPause ? `${config.emojis.pause} Paused` : `${config.emojis.play} Resumed`, 
          ephemeral: true 
        });
        break;
      }

      case 'skip': {
        player.stop();
        const disabledContainer = createNowPlayingContainer(player, player.current, true);
        await interaction.message.edit({ components: [disabledContainer], flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
        await interaction.reply({ content: `${config.emojis.skip} Skipped`, ephemeral: true });
        break;
      }

      case 'stop': {
        const disabledContainer = createNowPlayingContainer(player, player.current, true);
        await interaction.message.edit({ components: [disabledContainer], flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
        player.destroy();
        await interaction.reply({ content: `${config.emojis.stop} Stopped`, ephemeral: true });
        break;
      }

      case 'shuffle': {
        if (player.queue.length === 0) {
          return interaction.reply({ content: `${config.emojis.error} Queue is empty`
