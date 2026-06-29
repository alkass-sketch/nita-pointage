use strict;
use IO::Socket::INET;
use POSIX;

my $port = $ARGV[0] || 5173;
my $root = $ARGV[1] || do { require Cwd; Cwd::cwd() };

my %mime = (
    html => 'text/html; charset=utf-8',
    js   => 'application/javascript',
    json => 'application/json',
    css  => 'text/css',
    png  => 'image/png',
    ico  => 'image/x-icon',
    txt  => 'text/plain',
);

my $server = IO::Socket::INET->new(
    LocalAddr => '127.0.0.1',
    LocalPort => $port,
    Proto     => 'tcp',
    Listen    => 5,
    ReuseAddr => 1,
) or die "Cannot bind port $port: $!\n";

print "Serving $root on http://localhost:$port\n";
$| = 1;

while (my $client = $server->accept()) {
    my $req = <$client>;
    1 while <$client> =~ /\S/;
    my ($path) = ($req =~ m{GET (/[^ ]*) });
    $path //= '/';
    $path =~ s/%([0-9A-Fa-f]{2})/chr(hex($1))/ge;
    $path = '/' if $path eq '';
    $path = '/index.html' if $path eq '/';
    $path =~ s{/+}{/}g;
    $path =~ s{\.\.}{}g;
    my $file = $root . $path;
    if (-f $file) {
        my ($ext) = ($file =~ /\.(\w+)$/);
        my $ct = $mime{lc($ext // '')} // 'application/octet-stream';
        open my $fh, '<:raw', $file or next;
        my $body = do { local $/; <$fh> };
        close $fh;
        print $client "HTTP/1.1 200 OK\r\nContent-Type: $ct\r\nContent-Length: " . length($body) . "\r\nConnection: close\r\n\r\n$body";
    } else {
        print $client "HTTP/1.1 404 Not Found\r\nContent-Length: 9\r\nConnection: close\r\n\r\nNot Found";
    }
    close $client;
}
