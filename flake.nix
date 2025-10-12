{
  outputs = {nixpkgs, ...}: let
    inherit (nixpkgs) lib;
    forAllSystems = lib.genAttrs lib.systems.flakeExposed;
  in {
    devShells = forAllSystems (system: let
      pkgs = nixpkgs.legacyPackages.${system};
    in {
      default = pkgs.mkShellNoCC {
        packages = with pkgs; [nodejs openssl];
      };
    });
  };
}
