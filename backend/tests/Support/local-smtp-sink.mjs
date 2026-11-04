// Test-only loopback SMTP boundary; never relays or logs message content.
import { createServer } from 'node:net';
import { writeFile, realpath } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

const output = resolve(process.argv[2] || '');
const privateRoot = await realpath(resolve('storage/app/private'));
if (process.env.P1_COMBINED_TESTS !== '1' || process.env.DB_TEST_DISPOSABLE !== '1' ||
    !/^bc_dba_p1_/.test(process.env.DB_DATABASE || '') || !output.startsWith(privateRoot + sep) ||
    !/^recovery-mail-test-[a-f0-9]+\.eml$/.test(output.slice(privateRoot.length + 1)) || await realpath(dirname(output)) !== privateRoot) throw new Error('Use the private disposable mail fixture.');
const server = createServer(socket => {
  socket.setEncoding('utf8'); socket.setTimeout(10000, () => socket.destroy());
  socket.write('220 barangay-connect.local test sink\r\n');
  let buffered = '', data = false, message = '';
  socket.on('data', async chunk => {
    buffered += chunk;
    if (buffered.length + message.length > 32768) { socket.destroy(); return; }
    while (buffered.includes('\r\n')) {
      const at = buffered.indexOf('\r\n'), line = buffered.slice(0, at); buffered = buffered.slice(at + 2);
      if (data) {
        if (line === '.') {
          data = false;
          await writeFile(output, message, { flag: 'wx', mode: 0o600 });
          socket.write('250 stored privately\r\n');
        } else message += line.replace(/^\.\./, '.') + '\r\n';
      } else if (/^EHLO |^HELO /i.test(line)) socket.write('250-barangay-connect.local\r\n250 8BITMIME\r\n');
      else if (/^MAIL FROM:/i.test(line)) socket.write('250 sender accepted\r\n');
      else if (/^RCPT TO:<[^<>\s]+@example\.invalid>$/i.test(line)) socket.write('250 fictional recipient accepted\r\n');
      else if (/^DATA$/i.test(line)) { data = true; socket.write('354 end with dot\r\n'); }
      else if (/^QUIT$/i.test(line)) { socket.end('221 closing\r\n'); }
      else socket.write('550 unsupported test command or recipient\r\n');
    }
  });
  socket.on('error', () => {});
});
server.listen(0, '127.0.0.1', () => console.log(JSON.stringify({ port: server.address().port })));
const timer = setTimeout(() => server.close(), 25000); timer.unref();
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
