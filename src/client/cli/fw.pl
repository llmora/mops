#!/usr/bin/perl
#
# mops firewall client, identifies network connectivity of a specific application package and configures firewalls accordingly
#
# @author: Lluis Mora <lluismh@gmail.com>
# @url: https://github.com/llmora/mops

use strict;
use warnings;
use JSON;
use LWP::UserAgent;
use HTTP::Cookies;
use Encode;
use Config::Tiny;

# Configuration
my $CONFIGFILE = "fw.conf";
my $config = Config::Tiny->read( $CONFIGFILE, 'utf8' ) || die("Could not open configuration file \"$CONFIGFILE\"");

my %CONFIG = ();
$CONFIG{'api_base_url'} = $config->{_}->{'api_base_url'};
$CONFIG{'username'} = $config->{_}->{'username'};
$CONFIG{'password'} = $config->{_}->{'password'};

$::DEBUG = $config->{_}->{'debug'} || 0;

# End of configuration

sub usage() {
  die("Usage: $0 <packagename> <environment>");
}

sub log_ok($) {
  my $msg = shift;
  print "[+] $msg\n";
}

sub log_error($) {
  my $msg = shift;
  print "[-] $msg\n";
}

sub log_info($) {
  my $msg = shift;
  print "[*] $msg\n";
}

sub log_debug($) {
  if($::DEBUG > 0) {
    my $msg = shift;
    print "[D] $msg\n";
  }
}

sub resolve_services($$$$$$) {
  my ($ua, $config_ref, $service_ref, $retrievedservices_ref, $servicekb_ref, $servicetree_ref) = (@_);
  my %CONFIG = %{$config_ref};
  my @services = @{$service_ref};
  my @retrieved_services = @{$retrievedservices_ref};
#  my %servicekb = %{$service_dict_ref};
#  my %servicetree = %{$service_tree_ref};

  foreach my $service (@services) {

    if(! grep {$_ eq $service} @retrieved_services) {
      push(@retrieved_services, $service);

      log_info("Retrieving information for service \"" . $service . "\"");
      my $response = $ua->get($CONFIG{'api_base_url'} . '/api/service/' . $service);

      if ($response->is_success) {
        my %service = %{decode_json($response->content)};
        $servicekb_ref->{$service} = \%service;

        # Create dependency tree of services, taking care of potential loops

        my @dependent_services = @{$service{'dependencies'}};

        if(@dependent_services) {

          if(! defined $servicetree_ref->{$service}) {
            $servicetree_ref->{$service} = [];
          }

          push(@{$servicetree_ref->{$service}}, @dependent_services);
          resolve_services($ua, \%CONFIG, \@dependent_services, \@retrieved_services, $servicekb_ref, $servicetree_ref);
        }

      } else {
          die $response->status_line;
      }
    }
  }
  
}

my $PACKAGENAME = shift || usage();
my $ENVIRONMENT = shift || usage();

# Look-up environment before we waste any precious I/O
my $firewall_type = $config->{"env:" . $ENVIRONMENT}->{'firewall_type'};

if(! defined $firewall_type || ($firewall_type ne "netfilter" && $firewall_type ne "fortinet")) {
  die("Can't find firewall type for environment \"$ENVIRONMENT\"");
}

my $ua = LWP::UserAgent->new;
$ua->cookie_jar(HTTP::Cookies->new(file => "cookie_jar", autosave => 1));

# Login and store the session cookie for future queries

# TODO: Take snapshot to ensure atomic query

my %login_details = ('username' => $CONFIG{'username'}, 'password' => $CONFIG{'password'});

my $json_data = encode_json(\%login_details);

my $response = $ua->post(
  $CONFIG{'api_base_url'} . '/api/login',
  'Content-type'   => 'application/json;charset=utf-8',
  Content          => encode_utf8($json_data),
);

my @services = ();
my %servicekb = ();
my %servicetree = ();

if ($response->is_success) {
    my %user = %{decode_json($response->content)};
    
    if(defined $user{'username'}) {
      log_ok("Logged in as " . $user{'username'});

      # Retrieve all services that compose the package

      my $response = $ua->get($CONFIG{'api_base_url'} . '/api/package/' . $PACKAGENAME);

      if ($response->is_success) {
        my %package = %{decode_json($response->content)};

        my @package_services = @{$package{'services'}};

        resolve_services($ua, \%CONFIG, \@package_services, \@services, \%servicekb, \%servicetree);

        # For all consumed services, identify interfaces

        foreach my $source_service (keys %servicetree) {
          foreach my $target_service (@{$servicetree{$source_service}}) {
            log_debug("$source_service => $target_service : {" . join(",", @{$servicekb{$target_service}{'interfaces'}}) . "}");
          }
        }
        
        # Netfilter code
        if($firewall_type eq "netfilter") {
          log_info("TODO: Output netfilter code");
        } elsif ($firewall_type eq "fortinet") {
          log_info("TODO: Output fortinet code");
        }

      } else {
          die $response->status_line;
      }
      
    }
} else {
    die $response->status_line;
}
