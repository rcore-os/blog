{ pkgs ? import <nixpkgs> {} }:
  
pkgs.mkShell {
  buildInputs = with pkgs; [
    hexo-cli
  ];
}
